// Importa observações de um CSV externo para observacoes.json
// Filtra: Lepidoptera + área de estudo + sem duplicados
// Uso: node ferramentas/importar-csv-observacoes.js

const fs = require("fs");
const path = require("path");
const { parse } = require("csv-parse/sync");

const CSV     = path.join(__dirname, "../src/_data/observations-531454.csv");
const JSON_OBS = path.join(__dirname, "../src/_data/observacoes.json");

// ── Área de estudo (Marinha Grande, Leiria, Batalha, Porto de Mós) ──────────
const LAT_MIN = 39.46, LAT_MAX = 39.88;
const LON_MIN = -9.05, LON_MAX = -8.61;

// ── Conversão lat/lon → código UTM 1×1km (Zona 29N) ─────────────────────────
function latLonToUtm1k(lat, lon) {
  const a = 6378137.0, e2 = 0.00669437999014, k0 = 0.9996;
  const lon0 = -9 * Math.PI / 180;
  const latR = lat * Math.PI / 180;
  const lonR = lon * Math.PI / 180;

  const N   = a / Math.sqrt(1 - e2 * Math.sin(latR) ** 2);
  const T   = Math.tan(latR) ** 2;
  const C   = (e2 / (1 - e2)) * Math.cos(latR) ** 2;
  const A   = Math.cos(latR) * (lonR - lon0);
  const M   = a * (
    (1 - e2/4 - 3*e2**2/64 - 5*e2**3/256) * latR
    - (3*e2/8 + 3*e2**2/32 + 45*e2**3/1024) * Math.sin(2*latR)
    + (15*e2**2/256 + 45*e2**3/1024) * Math.sin(4*latR)
    - (35*e2**3/3072) * Math.sin(6*latR)
  );

  const easting  = k0 * N * (A + (1-T+C)*A**3/6 + (5-18*T+T**2+72*C-58*(e2/(1-e2)))*A**5/120) + 500000;
  const northing = k0 * (M + N * Math.tan(latR) * (A**2/2 + (5-T+9*C+4*C**2)*A**4/24 + (61-58*T+T**2+600*C-330*(e2/(1-e2)))*A**6/720));

  const COL = ['J','K','L','M','N','P','Q','R'];
  const ROW = ['A','B','C','D','E','F','G','H','J','K','L','M','N','P','Q','R','S','T','U','V'];
  const N_CYCLE = 4000000;

  const colIdx = Math.floor(easting / 100000) - 1;
  const sqE    = Math.floor((easting - (colIdx + 1) * 100000) / 1000);
  const rowIdx = Math.floor((northing - N_CYCLE) / 100000);
  const sqN    = Math.floor(((northing - N_CYCLE) - rowIdx * 100000) / 1000);

  if (colIdx < 0 || colIdx >= COL.length || rowIdx < 0 || rowIdx >= ROW.length) return null;
  return `${COL[colIdx]}${ROW[rowIdx]}${String(sqE).padStart(2,'0')}${String(sqN).padStart(2,'0')}`;
}

// ── Carregar dados existentes ─────────────────────────────────────────────────
const existentes = JSON.parse(fs.readFileSync(JSON_OBS, "utf-8"));
const ultimoId   = existentes.reduce((max, o) => {
  const n = parseInt((o.id || "obs-0").split("-")[1], 10);
  return n > max ? n : max;
}, 0);

// Chave de deduplicação: espécie + data + observador
const chavesExistentes = new Set(
  existentes.map(o => `${o.nome_cientifico}|${o.data}|${o.observador || ""}`)
);

// ── Processar CSV ─────────────────────────────────────────────────────────────
const csvTexto  = fs.readFileSync(CSV, "utf-8");
const linhas    = parse(csvTexto, { columns: true, skip_empty_lines: true, relax_quotes: true });

let contador = ultimoId;
let adicionadas = 0, ignoradasArea = 0, ignoradasOrdem = 0, ignoradasDup = 0;
const novas = [];

for (const linha of linhas) {
  // Filtrar por ordem
  if ((linha["order"] || linha["`order`"] || "").trim() !== "Lepidoptera") {
    ignoradasOrdem++;
    continue;
  }

  // Filtrar por área
  const lat = parseFloat(linha.decimalLatitude);
  const lon = parseFloat(linha.decimalLongitude);
  if (isNaN(lat) || isNaN(lon) || lat < LAT_MIN || lat > LAT_MAX || lon < LON_MIN || lon > LON_MAX) {
    ignoradasArea++;
    continue;
  }

  const nomeCientifico = (linha.canonicalName || linha.scientificName || "").trim();
  const data           = (linha.observationDate || "").trim().split("T")[0].split(" ")[0];
  const observador     = (linha.recordedBy || "").trim();
  const chave          = `${nomeCientifico}|${data}|${observador}`;

  if (chavesExistentes.has(chave)) {
    ignoradasDup++;
    continue;
  }

  // Calcular UTM 1km
  const utm1k = latLonToUtm1k(lat, lon);

  // Limpar local (remover sufixo ", PT-LE, PT" etc.)
  const local = (linha.locality || "").replace(/,\s*PT-[A-Z]+,\s*PT\s*$/, "").replace(/,\s*PT\s*$/, "").trim();

  const quantidade = parseInt(linha.individualCount, 10) || 1;

  contador++;
  const obs = {
    id: `obs-${String(contador).padStart(3, "0")}`,
    nome_cientifico: nomeCientifico,
    data,
    ...(utm1k && { utm1k }),
    ...(local && { local }),
    quantidade,
    ...(observador && { observador }),
  };

  novas.push(obs);
  chavesExistentes.add(chave); // evitar duplicados dentro do próprio CSV
}

// ── Guardar ───────────────────────────────────────────────────────────────────
const resultado = [...existentes, ...novas];
fs.writeFileSync(JSON_OBS, JSON.stringify(resultado, null, 4));

console.log(`Observações existentes : ${existentes.length}`);
console.log(`Ignoradas (fora área)  : ${ignoradasArea}`);
console.log(`Ignoradas (não Lepid.) : ${ignoradasOrdem}`);
console.log(`Ignoradas (duplicadas) : ${ignoradasDup}`);
console.log(`Adicionadas            : ${novas.length}`);
console.log(`Total final            : ${resultado.length}`);
