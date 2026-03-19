'use strict';
const fs   = require('fs');
const path = require('path');

const obs = require('./observacoes.json');

function lerFichas(dir, grupo) {
  const map = {};
  const urlBase = `/borboletas-${grupo}`;
  for (const familia of fs.readdirSync(dir)) {
    const familiaDir = path.join(dir, familia);
    if (!fs.statSync(familiaDir).isDirectory()) continue;
    for (const f of fs.readdirSync(familiaDir)) {
      if (!f.endsWith('.md')) continue;
      const txt = fs.readFileSync(path.join(familiaDir, f), 'utf8');
      const nome = txt.match(/nome_cientifico:\s*["']?([^"'\n]+)["']?/)?.[1]?.trim();
      if (nome) {
        map[nome] = {
          grupo,
          url: `${urlBase}/${familia}/${f.replace('.md', '')}/`,
        };
      }
    }
  }
  return map;
}

const BASE = path.join(__dirname, '..');
const fichas = {
  ...lerFichas(path.join(BASE, 'especies/diurnas'),  'diurnas'),
  ...lerFichas(path.join(BASE, 'especies/noturnas'), 'noturnas'),
};

// Contagem de observações por espécie (só as que têm ficha para saber o grupo)
const counts = {};
for (const o of obs) {
  const f = fichas[o.nome_cientifico];
  if (!f) continue;
  const k = `${f.grupo}|${o.nome_cientifico}`;
  counts[k] = (counts[k] || 0) + (o.quantidade || 1);
}

function top10(grupo) {
  return Object.entries(counts)
    .filter(([k]) => k.startsWith(`${grupo}|`))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([k, total]) => {
      const nome = k.slice(grupo.length + 1);
      return { nome, total, url: fichas[nome].url };
    });
}

module.exports = {
  diurnas:  top10('diurnas'),
  noturnas: top10('noturnas'),
};
