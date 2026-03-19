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
      const get = (campo) =>
        txt.match(new RegExp(`${campo}:\\s*["']?([^"'\\n]+)["']?`))?.[1]?.trim();
      const nome = get('nome_cientifico');
      if (!nome) continue;
      map[nome] = {
        grupo,
        url:         `${urlBase}/${familia}/${f.replace('.md', '')}/`,
        imagem:      get('imagem') || null,
        placeholder: /placeholder:\s*true/.test(txt),
      };
    }
  }
  return map;
}

const BASE = path.join(__dirname, '..');
const fichas = {
  ...lerFichas(path.join(BASE, 'especies/diurnas'),  'diurnas'),
  ...lerFichas(path.join(BASE, 'especies/noturnas'), 'noturnas'),
};

// Acumular por espécie: contagem, primeira e última observação (data+observador)
const acum = {};
for (const o of obs) {
  const f = fichas[o.nome_cientifico];
  if (!f || !o.data) continue;
  const k = `${f.grupo}|${o.nome_cientifico}`;
  if (!acum[k]) {
    acum[k] = { total: 0, primeira: null, ultima: null };
  }
  const a = acum[k];
  a.total += (o.quantidade || 1);
  if (!a.primeira || o.data < a.primeira.data) {
    a.primeira = { data: o.data, observador: o.observador || '' };
  }
  if (!a.ultima || o.data > a.ultima.data) {
    a.ultima = { data: o.data, observador: o.observador || '' };
  }
}

function top10(grupo) {
  return Object.entries(acum)
    .filter(([k]) => k.startsWith(`${grupo}|`))
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 10)
    .map(([k, a]) => {
      const nome = k.slice(grupo.length + 1);
      const f = fichas[nome];
      return {
        nome,
        url:         f.url,
        imagem:      f.imagem,
        placeholder: f.placeholder,
        total:       a.total,
        primeira:    { ...a.primeira, ano: a.primeira.data.slice(0, 4) },
        ultima:      { ...a.ultima,   ano: a.ultima.data.slice(0, 4) },
      };
    });
}

module.exports = {
  diurnas:  top10('diurnas'),
  noturnas: top10('noturnas'),
};
