// Computed data: espécies dos CSVs PNSAC que ocorrem na nossa área de estudo
// e não têm ficha no site.
const fs   = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');

module.exports = function () {
  // ── 1. UTM 10km da nossa área (a partir de observacoes.json) ──────────
  const obsPath = path.join(__dirname, 'observacoes.json');
  const obs = JSON.parse(fs.readFileSync(obsPath, 'utf-8'));
  const nossaAreaUtm = new Set();
  obs.forEach(o => {
    const u = (o.utm1k || '').trim();
    if (u.length >= 4) nossaAreaUtm.add(u.slice(0, 4));
  });

  // Bounding box geográfica da área de estudo (para CSV2 com lat/lon)
  const LAT_MIN = 39.46, LAT_MAX = 39.88;
  const LON_MIN = -9.05, LON_MAX = -8.61;

  // ── 2. Espécies com ficha no site ─────────────────────────────────────
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

  // ── 3. Mapa acumulador: nome → {familia, subfamilia, obs, fontes} ─────
  const map = {};

  function acumular(nome, familia, subfamilia, cnt, fonte) {
    if (!nome || nome.includes('cf.') || nome.includes('/')) return;
    if (fichas.has(nome)) return;
    if (!map[nome]) map[nome] = { familia, subfamilia, obs: 0, fontes: new Set() };
    map[nome].obs += cnt;
    map[nome].fontes.add(fonte);
  }

  // ── 4. CSV1: filtro por UTM 10km ──────────────────────────────────────
  const csv1Path = path.join(__dirname, 'BD_DCore_PNSAC_Lepidoptera.csv');
  if (fs.existsSync(csv1Path)) {
    const records = parse(fs.readFileSync(csv1Path, 'utf-8'), {
      columns: true, skip_empty_lines: true, relax_column_count: true, bom: true
    });
    for (const row of records) {
      const vloc = (row['verbatimLocality'] || '').trim();
      const mUtm = vloc.match(/^(?:29[A-Z])?([A-Z]{2}\d{2})/);
      if (!mUtm || !nossaAreaUtm.has(mUtm[1])) continue;
      const genero  = (row['genus'] || '').trim();
      const epithet = (row['specificEpithet'] || '').trim();
      if (!genero || !epithet) continue;
      const cnt = parseInt(row['individualCount'] || '1', 10) || 1;
      acumular(genero + ' ' + epithet, (row['family']||'').trim(), (row['subfamily']||'').trim(), cnt, 'CSV1');
    }
  }

  // ── 5. CSV2: filtro por lat/lon ───────────────────────────────────────
  const csv2Path = path.join(__dirname, 'BD_DCore_PNSAC_Lepidoptera2.csv');
  if (fs.existsSync(csv2Path)) {
    const records = parse(fs.readFileSync(csv2Path, 'utf-8'), {
      columns: true, skip_empty_lines: true, relax_column_count: true, bom: true
    });
    for (const row of records) {
      const latS = (row['decimalLatitude']  || '').replace(',', '.').trim();
      const lonS = (row['decimalLongitude'] || '').replace(',', '.').trim();
      const lat = parseFloat(latS), lon = parseFloat(lonS);
      if (isNaN(lat) || isNaN(lon)) continue;
      if (lat < LAT_MIN || lat > LAT_MAX || lon < LON_MIN || lon > LON_MAX) continue;
      const genero  = (row['genus'] || '').trim();
      const epithet = (row['specificEpithet'] || '').trim().replace(/\s+$/, '');
      if (!genero || !epithet) continue;
      const cnt = parseInt(row['individualCount'] || '1', 10) || 1;
      acumular(genero + ' ' + epithet, (row['family']||'').trim(), (row['subfamily']||'').trim(), cnt, 'CSV2');
    }
  }

  // ── 6. Ordenar por família → obs desc ────────────────────────────────
  return Object.entries(map)
    .map(([nome, v]) => ({ nome, familia: v.familia, subfamilia: v.subfamilia, obs: v.obs }))
    .sort((a, b) => a.familia.localeCompare(b.familia) || b.obs - a.obs);
};
