#!/usr/bin/env node
// Uso: node ferramentas/otimizar-imagens.js [--dry-run] [ficheiro1 ficheiro2 ...]
// Sem ficheiros: processa todos os JPG/PNG em imagens/ recursivamente

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const DRY_RUN = process.argv.includes('--dry-run');
const MAX_W = 1920;
const JPEG_Q = 85;
const ROOT = path.join(__dirname, '..');
const IMG_DIR = path.join(ROOT, 'imagens');

function encontrarImagens(dir) {
  const resultados = [];
  for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entrada.name);
    if (entrada.isDirectory()) {
      resultados.push(...encontrarImagens(p));
    } else if (/\.(jpe?g|png)$/i.test(entrada.name)) {
      resultados.push(p);
    }
  }
  return resultados;
}

async function otimizar(ficheiro) {
  const abs = path.isAbsolute(ficheiro) ? ficheiro : path.join(ROOT, ficheiro);
  if (!fs.existsSync(abs)) {
    console.error(`  [erro] não encontrado: ${abs}`);
    return 0;
  }

  const antesBytes = fs.statSync(abs).size;
  const ext = path.extname(abs).toLowerCase();
  const isPng = ext === '.png';

  let pipeline = sharp(abs).resize(MAX_W, null, { withoutEnlargement: true });

  if (isPng) {
    pipeline = pipeline.png({ compressionLevel: 9 });
  } else {
    pipeline = pipeline.jpeg({ quality: JPEG_Q, mozjpeg: true });
  }

  const buf = await pipeline.toBuffer();
  const depoisBytes = buf.length;
  const poupados = antesBytes - depoisBytes;

  if (!DRY_RUN) {
    fs.writeFileSync(abs, buf);
  }

  const rel = path.relative(ROOT, abs);
  const sinal = poupados >= 0 ? '-' : '+';
  const kb = (Math.abs(poupados) / 1024).toFixed(1);
  console.log(`  ${rel}: ${(antesBytes / 1024).toFixed(0)} KB → ${(depoisBytes / 1024).toFixed(0)} KB (${sinal}${kb} KB)`);

  return poupados;
}

async function main() {
  const args = process.argv.slice(2).filter(a => a !== '--dry-run');

  let ficheiros;
  if (args.length > 0) {
    ficheiros = args;
  } else {
    console.log(`[icarus] Procurando imagens em ${IMG_DIR}...`);
    ficheiros = encontrarImagens(IMG_DIR);
  }

  if (ficheiros.length === 0) {
    console.log('[icarus] Nenhuma imagem encontrada.');
    return;
  }

  if (DRY_RUN) console.log('[icarus] Modo --dry-run: nenhum ficheiro será modificado.\n');
  console.log(`[icarus] ${ficheiros.length} ficheiro(s) a processar...\n`);

  let totalAntes = 0;
  let totalPoupados = 0;

  for (const f of ficheiros) {
    const abs = path.isAbsolute(f) ? f : path.join(ROOT, f);
    if (fs.existsSync(abs)) totalAntes += fs.statSync(abs).size;
    const poupados = await otimizar(f);
    totalPoupados += poupados;
  }

  const totalDepois = totalAntes - totalPoupados;
  const pct = totalAntes > 0 ? ((totalPoupados / totalAntes) * 100).toFixed(1) : '0.0';
  console.log(`\n[icarus] Total: ${(totalAntes / 1024 / 1024).toFixed(1)} MB → ${(totalDepois / 1024 / 1024).toFixed(1)} MB (redução de ${pct}%)`);
  if (DRY_RUN) console.log('[icarus] (dry-run: nenhum ficheiro modificado)');
}

main().catch(err => {
  console.error('[icarus] Erro:', err.message);
  process.exit(1);
});
