#!/usr/bin/env node
/**
 * importar-inat.js
 *
 * Importa observações do CSV do iNaturalist para observacoes.json.
 *
 * Filtros aplicados:
 *  1. Licença utilizável (CC0, CC-BY, CC-BY-SA, CC-BY-NC, CC-BY-NC-SA)
 *  2. Coordenadas válidas e não obscurecidas
 *  3. Ponto dentro dos concelhos (Marinha Grande, Leiria, Batalha, Porto de Mós)
 *  4. Sem duplicados face às observações existentes (data + espécie + utm1k)
 *
 * Uso:
 *   node ferramentas/importar-inat.js [--csv ficheiro.csv] [--apply]
 */

'use strict';
const fs   = require('fs');
const path = require('path');

const APPLY    = process.argv.includes('--apply');
const csvArg   = process.argv.indexOf('--csv');
const CSV_FILE = csvArg >= 0
  ? process.argv[csvArg + 1]
  : path.join(__dirname, '../src/_data/observations-695800.csv');

const OBS_FILE      = path.join(__dirname, '../src/_data/observacoes.json');
const CONCELHOS_FILE= path.join(__dirname, '../src/assets/places/concelhos.geojson');

// Licenças que permitem uso dos dados
const LICENCAS_OK = new Set(['CC0', 'CC-BY', 'CC-BY-SA', 'CC-BY-NC', 'CC-BY-NC-SA']);

// ── CSV parser simples (trata campos entre aspas) ─────────────────────────────
function parseCsv(texto) {
  const linhas = texto.split(/\r?\n/).filter(Boolean);
  const cabecalho = parseLinha(linhas[0]);
  return linhas.slice(1).map(l => {
    const vals = parseLinha(l);
    const obj = {};
    cabecalho.forEach((k, i) => { if (k) obj[k] = (vals[i] || '').trim(); });
    return obj;
  });
}

function parseLinha(linha) {
  const cols = [];
  let cur = '', inQuote = false;
  for (let i = 0; i < linha.length; i++) {
    const c = linha[i];
    if (c === '"') { inQuote = !inQuote; }
    else if (c === ',' && !inQuote) { cols.push(cur); cur = ''; }
    else cur += c;
  }
  cols.push(cur);
  return cols;
}

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
  // coords = array de anéis; primeiro anel é o exterior
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

// ── Main ──────────────────────────────────────────────────────────────────────
const concelhos  = JSON.parse(fs.readFileSync(CONCELHOS_FILE, 'utf8')).features;
const obsAtuais  = JSON.parse(fs.readFileSync(OBS_FILE, 'utf8'));
const csvRows    = parseCsv(fs.readFileSync(CSV_FILE, 'utf8'));

// Chave de duplicado: data|espécie|utm1k
const chavesDuplicado = new Set(
  obsAtuais
    .filter(o => o.data && o.nome_cientifico && o.utm1k)
    .map(o => `${o.data}|${o.nome_cientifico}|${o.utm1k}`)
);

const novas = [];

// Contadores para relatório
const stats = {
  total: csvRows.length,
  semLicenca: 0,
  licencaNaoOk: 0,
  semCoordenadas: 0,
  coordenadasObscurecidas: 0,
  foraArea: 0,
  semEspecie: 0,
  duplicado: 0,
  importadas: 0,
};

for (const row of csvRows) {
  const licenca = row.license || '';

  if (!licenca) { stats.semLicenca++; continue; }
  if (!LICENCAS_OK.has(licenca)) { stats.licencaNaoOk++; continue; }

  // Coordenadas
  const lat = parseFloat(row.latitude);
  const lon = parseFloat(row.longitude);
  if (isNaN(lat) || isNaN(lon)) { stats.semCoordenadas++; continue; }

  // Obscurecidas (precisão insuficiente para UTM1k)
  if (row.coordinates_obscured === 'true' || row.taxon_geoprivacy === 'obscured' || row.taxon_geoprivacy === 'private') {
    stats.coordenadasObscurecidas++;
    continue;
  }

  // Espécie
  const especie = (row.scientific_name || '').trim();
  if (!especie) { stats.semEspecie++; continue; }

  // Verificar área
  const concelho = pontoNosConcelhos(lat, lon, concelhos);
  if (!concelho) { stats.foraArea++; continue; }

  // UTM1k
  const utm1k = latlonParaUtm1k(lat, lon);
  if (!utm1k) { stats.semCoordenadas++; continue; }

  // Duplicado
  const chave = `${row.observed_on}|${especie}|${utm1k}`;
  if (chavesDuplicado.has(chave)) { stats.duplicado++; continue; }
  chavesDuplicado.add(chave); // evitar duplicados dentro do próprio CSV

  // Observador
  const observador = (row.user_name || row.user_login || '').trim();

  // Construir observação
  const obs = {
    nome_cientifico: especie,
    data:            row.observed_on,
    utm1k,
    quantidade:      1,
    observador,
    fonte:           'iNaturalist',
    inat_uuid:       row.uuid,
  };

  if (row.description && row.description.length < 200) {
    obs.notas = row.description;
  }

  novas.push(obs);
  stats.importadas++;
}

// Relatório
console.log('\n══════════════════════════════════════════════════');
console.log('  Importação iNaturalist → observacoes.json');
console.log('══════════════════════════════════════════════════');
console.log(`  Total no CSV                  : ${stats.total}`);
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

// Prévia das primeiras novas observações
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

// Escrever
const todasObs = [...obsAtuais, ...novas];
fs.writeFileSync(OBS_FILE, JSON.stringify(todasObs) + '\n', 'utf8');
console.log(`✓ observacoes.json actualizado: ${obsAtuais.length} + ${novas.length} = ${todasObs.length} observações\n`);
