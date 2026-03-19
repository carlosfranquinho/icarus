#!/usr/bin/env node
/**
 * sincronizar-inat.js
 *
 * Sincroniza observações do projecto iNaturalist "grupo-icarus" via API pública.
 * Busca registos adicionados nos últimos 7 dias, aplica os mesmos filtros do
 * importar-inat.js e actualiza observacoes.json quando há novos registos.
 *
 * Filtros aplicados:
 *  1. quality_grade=research (filtro na API)
 *  2. Licença utilizável (CC0, CC-BY, CC-BY-SA, CC-BY-NC, CC-BY-NC-SA)
 *  3. Coordenadas válidas e não obscurecidas
 *  4. Ponto dentro dos concelhos (ray-casting no concelhos.geojson)
 *  5. Sem duplicados face às observações existentes (data|espécie|utm1k)
 *
 * Uso:
 *   node ferramentas/sincronizar-inat.js          # dry-run
 *   node ferramentas/sincronizar-inat.js --apply  # escreve observacoes.json
 */

'use strict';
const fs   = require('fs');
const path = require('path');

const APPLY = process.argv.includes('--apply');

const OBS_FILE       = path.join(__dirname, '../src/_data/observacoes.json');
const CONCELHOS_FILE = path.join(__dirname, '../src/assets/places/concelhos.geojson');

const INAT_PROJECT   = 'grupo-icarus';
const INAT_API_BASE  = 'https://api.inaturalist.org/v1';
const PER_PAGE       = 200;
const DELAY_MS       = 1000; // entre páginas — respeito à API

// Licenças que permitem uso dos dados
const LICENCAS_OK = new Set(['cc0', 'cc-by', 'cc-by-sa', 'cc-by-nc', 'cc-by-nc-sa']);

// ── WGS84 → UTM Zone 29N ─────────────────────────────────────────────────────
function latlonParaUtm29n(lat, lon) {
  const a  = 6378137.0, e2 = 0.00669437999014, k0 = 0.9996;
  const lon0 = -9 * Math.PI / 180;
  const latR = lat * Math.PI / 180;
  const lonR = lon * Math.PI / 180;

  const N  = a / Math.sqrt(1 - e2 * Math.sin(latR) ** 2);
  const T  = Math.tan(latR) ** 2;
  const C  = e2 / (1 - e2) * Math.cos(latR) ** 2;
  const A  = Math.cos(latR) * (lonR - lon0);
  const M  = a * (
    (1 - e2/4 - 3*e2**2/64 - 5*e2**3/256) * latR
    - (3*e2/8 + 3*e2**2/32 + 45*e2**3/1024) * Math.sin(2*latR)
    + (15*e2**2/256 + 45*e2**3/1024) * Math.sin(4*latR)
    - (35*e2**3/3072) * Math.sin(6*latR)
  );
  const E = k0 * N * (
    A + (1 - T + C) * A**3/6
    + (5 - 18*T + T**2 + 72*C - 58*e2/(1-e2)) * A**5/120
  ) + 500000;
  const Nn = k0 * (
    M + N * Math.tan(latR) * (
      A**2/2
      + (5 - T + 9*C + 4*C**2) * A**4/24
      + (61 - 58*T + T**2 + 600*C - 330*e2/(1-e2)) * A**6/720
    )
  );
  return { E, N: Nn };
}

function latlonParaUtm1k(lat, lon) {
  const { E, N } = latlonParaUtm29n(lat, lon);
  const N_CYCLE = 4000000;
  const COLUNAS = ['J','K','L','M','N','P','Q','R'];
  const LINHAS  = ['A','B','C','D','E','F','G','H','J','K','L','M','N','P','Q','R','S','T','U','V'];

  const colIdx = Math.floor(E / 100000) - 1;
  const N_rel  = N - N_CYCLE;
  if (colIdx < 0 || colIdx >= 8 || N_rel < 0) return null;
  const rowIdx = Math.floor(N_rel / 100000);
  if (rowIdx >= 20) return null;

  const sqE = Math.floor((E  % 100000) / 1000);
  const sqN = Math.floor((N_rel % 100000) / 1000);

  return `${COLUNAS[colIdx]}${LINHAS[rowIdx]}${String(sqE).padStart(2,'0')}${String(sqN).padStart(2,'0')}`;
}

// ── Ponto dentro de polígono (ray-casting) ────────────────────────────────────
function pontoNoPoligono(lat, lon, coords) {
  const anel = coords[0];
  let dentro = false;
  for (let i = 0, j = anel.length - 1; i < anel.length; j = i++) {
    const [xi, yi] = anel[i]; // [lon, lat]
    const [xj, yj] = anel[j];
    const intersect = ((yi > lat) !== (yj > lat))
      && (lon < (xj - xi) * (lat - yi) / (yj - yi) + xi);
    if (intersect) dentro = !dentro;
  }
  return dentro;
}

function pontoNosConcelhos(lat, lon, features) {
  for (const feat of features) {
    const geom = feat.geometry;
    if (geom.type === 'Polygon') {
      if (pontoNoPoligono(lat, lon, geom.coordinates)) return feat.properties.nome;
    } else if (geom.type === 'MultiPolygon') {
      for (const poly of geom.coordinates) {
        if (pontoNoPoligono(lat, lon, poly)) return feat.properties.nome;
      }
    }
  }
  return null;
}

// ── API iNaturalist ───────────────────────────────────────────────────────────
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function buscarPagina(params, pagina) {
  const url = new URL(`${INAT_API_BASE}/observations`);
  Object.entries({ ...params, page: pagina, per_page: PER_PAGE })
    .forEach(([k, v]) => url.searchParams.set(k, v));

  const res = await fetch(url.toString(), {
    headers: { 'Accept': 'application/json', 'User-Agent': 'grupo-icarus-site/1.0' },
  });
  if (!res.ok) throw new Error(`API erro ${res.status}: ${url}`);
  return res.json();
}

async function buscarTodasObservacoes(dataInicio) {
  const params = {
    project_id:    INAT_PROJECT,
    quality_grade: 'research',
    created_d1:    dataInicio,
    order:         'asc',
    order_by:      'created_at',
  };

  const resultados = [];
  let pagina = 1;
  let total  = null;

  while (true) {
    const dados = await buscarPagina(params, pagina);
    if (total === null) total = dados.total_results;

    resultados.push(...dados.results);
    console.log(`  página ${pagina}: ${dados.results.length} registos (${resultados.length}/${total})`);

    if (resultados.length >= total || dados.results.length === 0) break;
    pagina++;
    await sleep(DELAY_MS);
  }

  return { resultados, total };
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const concelhos = JSON.parse(fs.readFileSync(CONCELHOS_FILE, 'utf8')).features;
  const obsAtuais = JSON.parse(fs.readFileSync(OBS_FILE, 'utf8'));

  // Chave de duplicado: data|espécie|utm1k
  const chavesDuplicado = new Set(
    obsAtuais
      .filter(o => o.data && o.nome_cientifico && o.utm1k)
      .map(o => `${o.data}|${o.nome_cientifico}|${o.utm1k}`)
  );

  // Data de início: 7 dias atrás
  const dataInicio = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);

  console.log('\n══════════════════════════════════════════════════');
  console.log('  Sincronização iNaturalist → observacoes.json');
  console.log('══════════════════════════════════════════════════');
  console.log(`  Projecto  : ${INAT_PROJECT}`);
  console.log(`  Desde     : ${dataInicio} (últimos 7 dias)`);
  console.log(`  Modo      : ${APPLY ? 'APPLY' : 'dry-run'}`);
  console.log('──────────────────────────────────────────────────');
  console.log('  A buscar observações...');

  const { resultados, total } = await buscarTodasObservacoes(dataInicio);

  console.log('──────────────────────────────────────────────────');

  const stats = {
    total,
    semLicenca:              0,
    licencaNaoOk:            0,
    semEspecie:              0,
    semCoordenadas:          0,
    coordenadasObscurecidas: 0,
    foraArea:                0,
    duplicado:               0,
    importadas:              0,
  };

  const novas = [];

  for (const obs of resultados) {
    // Licença
    const licenca = (obs.license_code || '').toLowerCase();
    if (!licenca) { stats.semLicenca++; continue; }
    if (!LICENCAS_OK.has(licenca)) { stats.licencaNaoOk++; continue; }

    // Espécie
    const especie = (obs.taxon && obs.taxon.name || '').trim();
    if (!especie) { stats.semEspecie++; continue; }

    // Coordenadas — a API devolve "lat,lon" em location
    const location = obs.location || '';
    if (!location) { stats.semCoordenadas++; continue; }
    const [latStr, lonStr] = location.split(',');
    const lat = parseFloat(latStr);
    const lon = parseFloat(lonStr);
    if (isNaN(lat) || isNaN(lon)) { stats.semCoordenadas++; continue; }

    // Obscurecidas
    if (obs.obscured || obs.taxon_geoprivacy === 'obscured' || obs.taxon_geoprivacy === 'private') {
      stats.coordenadasObscurecidas++;
      continue;
    }

    // Verificar área
    const concelho = pontoNosConcelhos(lat, lon, concelhos);
    if (!concelho) { stats.foraArea++; continue; }

    // UTM1k
    const utm1k = latlonParaUtm1k(lat, lon);
    if (!utm1k) { stats.semCoordenadas++; continue; }

    // Duplicado
    const chave = `${obs.observed_on}|${especie}|${utm1k}`;
    if (chavesDuplicado.has(chave)) { stats.duplicado++; continue; }
    chavesDuplicado.add(chave);

    // Construir observação
    const novaObs = {
      nome_cientifico: especie,
      data:            obs.observed_on,
      utm1k,
      quantidade:      1,
      observador:      obs.user && obs.user.login || '',
      fonte:           'iNaturalist',
      inat_uuid:       obs.uuid,
    };

    if (obs.description && obs.description.length < 200) {
      novaObs.notas = obs.description;
    }

    novas.push(novaObs);
    stats.importadas++;
  }

  // Relatório
  console.log(`  Total na API (últimos 7 dias) : ${stats.total}`);
  console.log(`  Sem licença (all rights res.) : ${stats.semLicenca}`);
  console.log(`  Licença não utilizável (ND)   : ${stats.licencaNaoOk}`);
  console.log(`  Sem espécie identificada      : ${stats.semEspecie}`);
  console.log(`  Coordenadas inválidas/ausentes: ${stats.semCoordenadas}`);
  console.log(`  Coordenadas obscurecidas      : ${stats.coordenadasObscurecidas}`);
  console.log(`  Fora da área de estudo        : ${stats.foraArea}`);
  console.log(`  Duplicados (já existem)       : ${stats.duplicado}`);
  console.log('──────────────────────────────────────────────────');
  console.log(`  Para importar                 : ${stats.importadas}`);
  console.log(`  Observações actuais           : ${obsAtuais.length}`);
  console.log(`  Total após importação         : ${obsAtuais.length + stats.importadas}`);
  console.log('══════════════════════════════════════════════════\n');

  if (novas.length > 0) {
    console.log('Prévia (primeiras 5):');
    novas.slice(0, 5).forEach(o =>
      console.log(`  ${o.data}  ${o.nome_cientifico.padEnd(30)} ${o.utm1k}  ${o.observador}`)
    );
    console.log('');
  }

  if (!APPLY) {
    console.log('(dry-run — adiciona --apply para escrever observacoes.json)\n');
    process.exit(0);
  }

  if (novas.length === 0) {
    console.log('Sem novas observações — observacoes.json inalterado.\n');
    process.exit(0);
  }

  const todasObs = [...obsAtuais, ...novas];
  fs.writeFileSync(OBS_FILE, JSON.stringify(todasObs) + '\n', 'utf8');
  console.log(`✓ observacoes.json actualizado: ${obsAtuais.length} + ${novas.length} = ${todasObs.length} observações\n`);
}

main().catch(err => {
  console.error('Erro:', err.message);
  process.exit(1);
});
