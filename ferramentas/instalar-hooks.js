#!/usr/bin/env node
// Instala os hooks de git versionados em ferramentas/hooks/
// Uso: node ferramentas/instalar-hooks.js

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const HOOKS_SRC = path.join(__dirname, 'hooks');
const HOOKS_DST = path.join(ROOT, '.git', 'hooks');

if (!fs.existsSync(path.join(ROOT, '.git'))) {
  console.error('[icarus] Erro: não é um repositório git (pasta .git não encontrada).');
  process.exit(1);
}

const hooks = fs.readdirSync(HOOKS_SRC);
let instalados = 0;

for (const hook of hooks) {
  const src = path.join(HOOKS_SRC, hook);
  const dst = path.join(HOOKS_DST, hook);

  // Tornar o hook executável
  fs.chmodSync(src, 0o755);

  // Remover destino existente (link ou ficheiro)
  try { fs.unlinkSync(dst); } catch {}

  fs.symlinkSync(src, dst);
  console.log(`[icarus] Hook instalado: .git/hooks/${hook} → ${path.relative(ROOT, src)}`);
  instalados++;
}

console.log(`[icarus] ${instalados} hook(s) instalado(s).`);
