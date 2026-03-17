#!/usr/bin/env node
/**
 * especies-sem-ficha.js
 * Cruza observações com fichas de espécies existentes.
 * Lista espécies com ≥ MIN_OBS observações mas sem ficha de espécie criada.
 *
 * Uso: node ferramentas/especies-sem-ficha.js [min_obs]
 *      (min_obs padrão: 5)
 */

const fs = require('fs');
const path = require('path');

const MIN_OBS = parseInt(process.argv[2] || '5', 10);
const OBS_FILE = path.join(__dirname, '../src/_data/observacoes.json');
const ESPECIES_DIR = path.join(__dirname, '../src/especies');

// --- Ler observações ---
const observacoes = JSON.parse(fs.readFileSync(OBS_FILE, 'utf8'));

// Contar observações por espécie (soma de quantidades)
const contagens = {};
for (const obs of observacoes) {
  const sp = obs.nome_cientifico;
  if (!sp) continue;
  contagens[sp] = (contagens[sp] || 0) + (Number(obs.quantidade) || 1);
}

// --- Ler fichas existentes (tipo: especie) ---
function lerFichas(dir) {
  const fichas = new Map(); // nome_cientifico → { familia, grupo, ficheiro }
  if (!fs.existsSync(dir)) return fichas;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      for (const [k, v] of lerFichas(fullPath)) fichas.set(k, v);
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      const conteudo = fs.readFileSync(fullPath, 'utf8');
      const m = conteudo.match(/^---\n([\s\S]*?)\n---/);
      if (!m) continue;
      const fm = m[1];

      const tipo = (fm.match(/^tipo:\s*(.+)$/m) || [])[1]?.trim();
      if (tipo !== 'especie') continue;

      const nome = (fm.match(/^nome_cientifico:\s*"?([^"\n]+)"?/m) || [])[1]?.trim();
      const familia = (fm.match(/^familia:\s*(.+)$/m) || [])[1]?.trim();
      const grupo = (fm.match(/^grupo:\s*(.+)$/m) || [])[1]?.trim();
      if (!nome) continue;

      fichas.set(nome, { familia, grupo, ficheiro: path.relative(ESPECIES_DIR, fullPath) });
    }
  }
  return fichas;
}

const fichasExistentes = lerFichas(ESPECIES_DIR);

// --- Cruzar: espécies com obs ≥ MIN_OBS mas sem ficha ---
const semFicha = Object.entries(contagens)
  .filter(([sp, n]) => n >= MIN_OBS && !fichasExistentes.has(sp))
  .sort((a, b) => b[1] - a[1]);

// Espécies com ficha (para referência)
const comFicha = Object.entries(contagens)
  .filter(([sp]) => fichasExistentes.has(sp))
  .sort((a, b) => b[1] - a[1]);

// --- Relatório ---
const totalObs = observacoes.length;
const totalEspecies = Object.keys(contagens).length;

console.log('');
console.log('═══════════════════════════════════════════════════════');
console.log('  Grupo icarus — Priorização de fichas de espécies');
console.log('═══════════════════════════════════════════════════════');
console.log(`  Observações totais  : ${totalObs}`);
console.log(`  Espécies observadas : ${totalEspecies}`);
console.log(`  Fichas existentes   : ${fichasExistentes.size}`);
console.log(`  Sem ficha (≥${MIN_OBS} obs)  : ${semFicha.length}`);
console.log('───────────────────────────────────────────────────────');

if (semFicha.length === 0) {
  console.log('\n  ✓ Todas as espécies com ≥' + MIN_OBS + ' observações têm ficha!\n');
} else {
  console.log(`\n  Espécies com ≥${MIN_OBS} observações SEM ficha (por prioridade):\n`);
  const maxLen = Math.max(...semFicha.map(([sp]) => sp.length));
  for (const [sp, n] of semFicha) {
    const barra = '█'.repeat(Math.min(20, Math.round(n / 2)));
    console.log(`  ${sp.padEnd(maxLen)}  ${String(n).padStart(4)} obs  ${barra}`);
  }
}

if (comFicha.length > 0) {
  console.log('\n───────────────────────────────────────────────────────');
  console.log('  Espécies COM ficha (por observações):\n');
  const maxLen = Math.max(...comFicha.map(([sp]) => sp.length));
  for (const [sp, n] of comFicha) {
    const info = fichasExistentes.get(sp);
    const tag = `[${info.grupo || '?'}/${info.familia || '?'}]`;
    console.log(`  ${sp.padEnd(maxLen)}  ${String(n).padStart(4)} obs  ${tag}`);
  }
}

// Espécies com obs mas nunca vistas no site
const soPoucasObs = Object.entries(contagens)
  .filter(([sp, n]) => n < MIN_OBS && !fichasExistentes.has(sp));
if (soPoucasObs.length > 0) {
  console.log('\n───────────────────────────────────────────────────────');
  console.log(`  Espécies com < ${MIN_OBS} obs e sem ficha (${soPoucasObs.length}):\n`);
  const sorted = soPoucasObs.sort((a, b) => b[1] - a[1]);
  for (const [sp, n] of sorted) {
    console.log(`  ${sp}  (${n} obs)`);
  }
}

console.log('\n═══════════════════════════════════════════════════════\n');
