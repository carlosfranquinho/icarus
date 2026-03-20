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
const { LICENCAS_OK, latlonParaUtm1k, pontoNosConcelhos } = require('./utils-geo');

const APPLY    = process.argv.includes('--apply');
const csvArg   = process.argv.indexOf('--csv');
const CSV_FILE = csvArg >= 0
  ? process.argv[csvArg + 1]
  : path.join(__dirname, '../src/_data/observations-695800.csv');

const OBS_FILE      = path.join(__dirname, '../src/_data/observacoes.json');
const CONCELHOS_FILE= path.join(__dirname, '../src/assets/places/concelhos.geojson');

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
  const licenca = (row.license || '').toLowerCase();

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
