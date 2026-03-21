// Computed data: espécies dos CSVs PNSAC que ocorrem na nossa área de estudo
// (concelhos.geojson) e não têm ficha no site.
const fs   = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');

// ── UTM/MGRS → LatLon (zona 29N, Portugal) ───────────────────────────────────
const A = 6378137.0, E2 = 0.00669437999014, K0 = 0.9996;
const LON0 = -9 * Math.PI / 180;
const COL_OFF = {J:0,K:1,L:2,M:3,N:4,P:5,Q:6,R:7};
const ROW_OFF = {A:0,B:1,C:2,D:3,E:4,F:5,G:6,H:7,J:8,K:9,L:10,M:11,N:12,P:13,Q:14,R:15,S:16,T:17,U:18,V:19};
const N_CYCLE = 4000000;

function utmToLatLon(E, N) {
  const e1  = (1 - Math.sqrt(1 - E2)) / (1 + Math.sqrt(1 - E2));
  const e2p = E2 / (1 - E2);
  const M   = N / K0;
  const mu  = M / (A * (1 - E2/4 - 3*E2*E2/64 - 5*E2*E2*E2/256));
  const phi1 = mu
    + (3*e1/2 - 27*e1**3/32)         * Math.sin(2*mu)
    + (21*e1**2/16 - 55*e1**4/32)    * Math.sin(4*mu)
    + (151*e1**3/96)                  * Math.sin(6*mu)
    + (1097*e1**4/512)                * Math.sin(8*mu);
  const N1 = A / Math.sqrt(1 - E2*Math.sin(phi1)**2);
  const T1 = Math.tan(phi1)**2;
  const C1 = e2p*Math.cos(phi1)**2;
  const R1 = A*(1-E2) / (1-E2*Math.sin(phi1)**2)**1.5;
  const D  = (E - 500000) / (N1 * K0);
  const lat = phi1 - (N1*Math.tan(phi1)/R1) * (
    D**2/2
    - (5+3*T1+10*C1-4*C1**2-9*e2p)*D**4/24
    + (61+90*T1+298*C1+45*T1**2-252*e2p-3*C1**2)*D**6/720
  );
  const lon = LON0 + (
    D - (1+2*T1+C1)*D**3/6
    + (5-2*C1+28*T1-3*C1**2+8*e2p+24*T1**2)*D**5/120
  ) / Math.cos(phi1);
  return { lat: lat * 180/Math.PI, lon: lon * 180/Math.PI };
}

function mgrsToLatLon(code) {
  // code like "ND1679" (2 letters + 4 digits, 1km precision), centroid
  if (!code || code.length < 6) return null;
  const colIdx = COL_OFF[code[0]], rowIdx = ROW_OFF[code[1]];
  if (colIdx === undefined || rowIdx === undefined) return null;
  const sqE = parseInt(code.slice(2, 4), 10);
  const sqN = parseInt(code.slice(4, 6), 10);
  if (isNaN(sqE) || isNaN(sqN)) return null;
  const E = (colIdx + 1) * 100000 + sqE * 1000 + 500; // centroid
  const N = N_CYCLE + rowIdx * 100000 + sqN * 1000 + 500;
  return utmToLatLon(E, N);
}

// ── Ponto-em-polígono (ray casting) ──────────────────────────────────────────
function pointInRing(lat, lon, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j]; // GeoJSON: [lon, lat]
    if (((yi > lat) !== (yj > lat)) &&
        lon < (xj - xi) * (lat - yi) / (yj - yi) + xi)
      inside = !inside;
  }
  return inside;
}

function pointInFeatures(lat, lon, features) {
  for (const feat of features) {
    const geom = feat.geometry;
    const polys = geom.type === 'Polygon'
      ? [geom.coordinates]
      : geom.coordinates; // MultiPolygon
    for (const poly of polys) {
      if (pointInRing(lat, lon, poly[0])) return true; // outer ring only
    }
  }
  return false;
}

// ── Main ──────────────────────────────────────────────────────────────────────
module.exports = function () {
  // 1. Carregar GeoJSON dos concelhos
  const gjPath = path.join(__dirname, '..', 'assets', 'places', 'concelhos.geojson');
  const { features } = JSON.parse(fs.readFileSync(gjPath, 'utf-8'));

  // 2. Espécies com ficha no site
  const fichas = new Set();
  const especiesDir = path.join(__dirname, '..', 'especies');
  function scanDir(dir) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) { scanDir(full); continue; }
      if (!entry.name.endsWith('.md')) continue;
      const content = fs.readFileSync(full, 'utf-8');
      const m = content.match(/^nome_cientifico:\s*"?([^"\n]+)"?/m);
      if (m) fichas.add(m[1].trim());
    }
  }
  scanDir(especiesDir);

  // 3. Acumulador: nome → {familia, subfamilia, obs}
  const map = {};
  function acumular(nome, familia, subfamilia, cnt) {
    if (!nome || nome.includes('cf.') || nome.includes('/')) return;
    if (fichas.has(nome)) return;
    if (!map[nome]) map[nome] = { familia, subfamilia, obs: 0 };
    map[nome].obs += cnt;
  }

  // 4. CSV1: verbatimLocality com código UTM/MGRS
  const csv1Path = path.join(__dirname, 'BD_DCore_PNSAC_Lepidoptera.csv');
  if (fs.existsSync(csv1Path)) {
    const records = parse(fs.readFileSync(csv1Path, 'utf-8'), {
      columns: true, skip_empty_lines: true, relax_column_count: true, bom: true
    });
    for (const row of records) {
      const vloc = (row['verbatimLocality'] || '').trim();
      // Strip prefixo de zona (ex: "29S") e obter código de 6 chars
      const code = vloc.replace(/^29[A-Z]/, '');
      if (code.length < 6) continue;
      const pt = mgrsToLatLon(code.slice(0, 6));
      if (!pt || !pointInFeatures(pt.lat, pt.lon, features)) continue;
      if ((row['order'] || '').trim() !== 'Lepidoptera') continue;
      const genero  = (row['genus'] || '').trim();
      const epithet = (row['specificEpithet'] || '').trim();
      if (!genero || !epithet) continue;
      const cnt = parseInt(row['individualCount'] || '1', 10) || 1;
      acumular(genero + ' ' + epithet, (row['family']||'').trim(), (row['subfamily']||'').trim(), cnt);
    }
  }

  // 5. CSV2: decimalLatitude / decimalLongitude
  const csv2Path = path.join(__dirname, 'BD_DCore_PNSAC_Lepidoptera2.csv');
  if (fs.existsSync(csv2Path)) {
    const records = parse(fs.readFileSync(csv2Path, 'utf-8'), {
      columns: true, skip_empty_lines: true, relax_column_count: true, bom: true
    });
    for (const row of records) {
      const lat = parseFloat((row['decimalLatitude']  || '').replace(',', '.'));
      const lon = parseFloat((row['decimalLongitude'] || '').replace(',', '.'));
      if (isNaN(lat) || isNaN(lon)) continue;
      if (!pointInFeatures(lat, lon, features)) continue;
      if ((row['order'] || '').trim() !== 'Lepidoptera') continue;
      const genero  = (row['genus'] || '').trim();
      const epithet = (row['specificEpithet'] || '').trim().replace(/\s+$/, '');
      if (!genero || !epithet) continue;
      const cnt = parseInt(row['individualCount'] || '1', 10) || 1;
      acumular(genero + ' ' + epithet, (row['family']||'').trim(), (row['subfamily']||'').trim(), cnt);
    }
  }

  // 6. Ordenar por família → obs desc
  return Object.entries(map)
    .map(([nome, v]) => ({ nome, familia: v.familia, subfamilia: v.subfamilia, obs: v.obs }))
    .sort((a, b) => a.familia.localeCompare(b.familia) || b.obs - a.obs);
};
