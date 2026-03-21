'use strict';
const fs   = require('fs');
const path = require('path');

const obs = require('./observacoes.json');

function lerFichas(dir, grupo) {
  const map = {};
  for (const familia of fs.readdirSync(dir)) {
    const familiaDir = path.join(dir, familia);
    if (!fs.statSync(familiaDir).isDirectory()) continue;
    for (const f of fs.readdirSync(familiaDir)) {
      if (!f.endsWith('.md')) continue;
      const txt = fs.readFileSync(path.join(familiaDir, f), 'utf8');
      const get = (campo) =>
        txt.match(new RegExp(`${campo}:\\s*["']?([^"'\\n]+)["']?`))?.[1]?.trim();
      const nome = get('nome_cientifico');
      if (!nome) continue;
      const placeholder = /placeholder:\s*true/.test(txt);
      map[nome] = { grupo, placeholder };
    }
  }
  return map;
}

const BASE = path.join(__dirname, '..');
const fichas = {
  ...lerFichas(path.join(BASE, 'especies/diurnas'),  'diurnas'),
  ...lerFichas(path.join(BASE, 'especies/noturnas'), 'noturnas'),
};

// Contar registos (linhas) por espécie — espécies sem ficha completa
const contagens = {};
for (const o of obs) {
  if (!o.nome_cientifico) continue;
  const ficha = fichas[o.nome_cientifico];
  // Ignorar espécies com ficha completa (sem placeholder)
  if (ficha && !ficha.placeholder) continue;
  if (!contagens[o.nome_cientifico]) {
    contagens[o.nome_cientifico] = { n: 0, placeholder: ficha ? ficha.placeholder : false };
  }
  contagens[o.nome_cientifico].n++;
}

module.exports = Object.entries(contagens)
  .sort((a, b) => b[1].n - a[1].n)
  .map(([nome, { n, placeholder }]) => ({ nome, n, placeholder }));
