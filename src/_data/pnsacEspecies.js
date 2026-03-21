// Computed data: espécies do CSV PNSAC que ocorrem na nossa área de estudo
// e não têm ficha no site.
const fs   = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');

module.exports = function () {
  // ── 1. UTM 10km da nossa área (a partir de observacoes.json) ──────────
  const obsPath = path.join(__dirname, 'observacoes.json');
  const obs = JSON.parse(fs.readFileSync(obsPath, 'utf-8'));
  const nossaArea = new Set();
  obs.forEach(o => {
    const u = (o.utm1k || '').trim();
    if (u.length >= 4) nossaArea.add(u.slice(0, 4));
  });

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

  // ── 3. Parsear CSV PNSAC ──────────────────────────────────────────────
  const csvPath = path.join(__dirname, 'BD_DCore_PNSAC_Lepidoptera.csv');
  if (!fs.existsSync(csvPath)) return [];

  const records = parse(fs.readFileSync(csvPath, 'utf-8'), {
    columns: true, skip_empty_lines: true, relax_column_count: true,
    bom: true
  });

  // ── 4. Filtrar por área + agregar ─────────────────────────────────────
  const map = {}; // nome -> {familia, subfamilia, obs}
  for (const row of records) {
    const vloc = (row['verbatimLocality'] || '').trim();
    const mUtm = vloc.match(/^(?:29[A-Z])?([A-Z]{2}\d{2})/);
    if (!mUtm || !nossaArea.has(mUtm[1])) continue;

    const genero  = (row['genus'] || '').trim();
    const epithet = (row['specificEpithet'] || '').trim();
    if (!genero || !epithet) continue;
    const nome = genero + ' ' + epithet;

    // Excluir nomes com cf. ou / (identificações incertas)
    if (nome.includes('cf.') || nome.includes('/')) continue;

    if (fichas.has(nome)) continue; // já tem ficha

    const familia    = (row['family'] || '').trim();
    const subfamilia = (row['subfamily'] || '').trim();
    const cnt = parseInt(row['individualCount'] || '1', 10) || 1;

    if (!map[nome]) map[nome] = { familia, subfamilia, obs: 0 };
    map[nome].obs += cnt;
  }

  // ── 5. Ordenar por família → obs desc ────────────────────────────────
  return Object.entries(map)
    .map(([nome, v]) => ({ nome, ...v }))
    .sort((a, b) =>
      a.familia.localeCompare(b.familia) || b.obs - a.obs
    );
};
