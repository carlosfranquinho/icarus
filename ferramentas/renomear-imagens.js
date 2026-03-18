#!/usr/bin/env node
// ferramentas/renomear-imagens.js
// Uniformiza nomes de imagens para o formato YYYYMM-XXXXXXX.ext
// Uso: node ferramentas/renomear-imagens.js [--dry-run]

'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const IMAGENS_DIR = path.join(ROOT, 'imagens');
const SRC_DIR = path.join(ROOT, 'src');

const DRY_RUN = process.argv.includes('--dry-run');

// Logos a preservar (não renomear)
const LOGOS_EXCLUIDOS = new Set([
  path.join(IMAGENS_DIR, 'logo', 'icarus_logo1.png'),
  path.join(IMAGENS_DIR, 'logo', 'icarus_logo3.png'),
  path.join(IMAGENS_DIR, '2020', '07', 'icarus_logo1.png'),
  path.join(IMAGENS_DIR, '2020', '07', 'icarus_logo3.png'),
]);

const FORMATO_FINAL = /^\d{6}-[0-9A-Z]{7}\.(jpe?g|png)$/i;

// --- Utilitários ---

function hashFicheiro(filePath) {
  const buf = fs.readFileSync(filePath);
  const hashHex = crypto.createHash('sha256').update(buf).digest('hex');
  const hashInt = BigInt('0x' + hashHex);
  return hashInt.toString(36).toUpperCase().padStart(7, '0').slice(0, 7);
}

function extrairYYYYMM(filePath) {
  // Espera estrutura imagens/YYYY/MM/ficheiro
  const rel = path.relative(IMAGENS_DIR, filePath);
  const parts = rel.split(path.sep);
  if (parts.length >= 3) {
    const ano = parts[0];
    const mes = parts[1].padStart(2, '0');
    if (/^\d{4}$/.test(ano) && /^\d{2}$/.test(mes)) {
      return ano + mes;
    }
  }
  return null;
}

function listarImagens(dir) {
  const resultados = [];
  function percorrer(d) {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const fullPath = path.join(d, entry.name);
      if (entry.isDirectory()) {
        percorrer(fullPath);
      } else if (/\.(jpe?g|png)$/i.test(entry.name)) {
        resultados.push(fullPath);
      }
    }
  }
  percorrer(dir);
  return resultados;
}

function listarFicheirosTexto(dirs, exts) {
  const resultados = [];
  function percorrer(d) {
    if (!fs.existsSync(d)) return;
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const fullPath = path.join(d, entry.name);
      if (entry.isDirectory()) {
        percorrer(fullPath);
      } else if (exts.some(ext => entry.name.endsWith(ext))) {
        resultados.push(fullPath);
      }
    }
  }
  for (const d of dirs) percorrer(d);
  return resultados;
}

// --- Lógica principal ---

function construirMapeamento(imagens) {
  // oldRelUrl → newRelUrl  (ex: "/imagens/2020/06/foo.jpg" → "/imagens/2020/06/202006-A3F9K2M.jpg")
  // oldAbsPath → newAbsPath
  const mapaUrl = new Map();
  const mapaPath = new Map();
  const novoNomesVistos = new Map(); // novoAbsPath → oldAbsPath (para detectar colisões)

  for (const filePath of imagens) {
    if (LOGOS_EXCLUIDOS.has(filePath)) continue;

    const nome = path.basename(filePath);
    const extOrig = path.extname(nome).toLowerCase();
    const ext = extOrig === '.jpeg' ? '.jpg' : extOrig;

    if (FORMATO_FINAL.test(nome)) continue; // já no formato

    const yyyymm = extrairYYYYMM(filePath);
    if (!yyyymm) {
      console.warn(`  AVISO: não foi possível extrair YYYYMM de ${filePath} — saltado`);
      continue;
    }

    const hash7 = hashFicheiro(filePath);
    const novoNome = `${yyyymm}-${hash7}${ext}`;
    const novoCaminho = path.join(path.dirname(filePath), novoNome);

    if (novoNomesVistos.has(novoCaminho)) {
      console.error(`  ERRO: colisão de hash!`);
      console.error(`    ${novoNomesVistos.get(novoCaminho)}`);
      console.error(`    ${filePath}`);
      console.error(`    → ${novoCaminho}`);
      process.exit(1);
    }
    novoNomesVistos.set(novoCaminho, filePath);

    const oldUrl = '/' + path.relative(ROOT, filePath).replace(/\\/g, '/');
    const newUrl = '/' + path.relative(ROOT, novoCaminho).replace(/\\/g, '/');

    mapaUrl.set(oldUrl, newUrl);
    mapaPath.set(filePath, novoCaminho);
  }

  return { mapaUrl, mapaPath };
}

function actualizarFicheiro(filePath, mapaUrl) {
  let conteudo = fs.readFileSync(filePath, 'utf8');
  let substituicoes = 0;

  for (const [oldUrl, newUrl] of mapaUrl) {
    if (conteudo.includes(oldUrl)) {
      const partes = conteudo.split(oldUrl);
      substituicoes += partes.length - 1;
      conteudo = partes.join(newUrl);
    }
  }

  return { conteudo, substituicoes };
}

// --- Main ---

console.log(`\n=== renomear-imagens.js${DRY_RUN ? ' [DRY-RUN]' : ''} ===\n`);

const imagens = listarImagens(IMAGENS_DIR);
console.log(`Imagens encontradas: ${imagens.length}`);

const { mapaUrl, mapaPath } = construirMapeamento(imagens);
console.log(`Ficheiros a renomear: ${mapaPath.size}\n`);

if (mapaPath.size === 0) {
  console.log('Nada a fazer.');
  process.exit(0);
}

// Mostrar plano
for (const [oldPath, newPath] of mapaPath) {
  const oldRel = path.relative(ROOT, oldPath);
  const newRel = path.relative(ROOT, newPath);
  console.log(`  ${oldRel} → ${path.basename(newRel)}`);
}
console.log('');

if (DRY_RUN) {
  // Em dry-run, mostrar também quantas referências seriam actualizadas
  const ficheirosTexto = listarFicheirosTexto([SRC_DIR], ['.md', '.njk', '.json']);
  let totalSubst = 0;
  let ficheirosAfectados = 0;
  for (const f of ficheirosTexto) {
    const { substituicoes } = actualizarFicheiro(f, mapaUrl);
    if (substituicoes > 0) {
      console.log(`  [refs] ${path.relative(ROOT, f)}: ${substituicoes} substituição(ões)`);
      totalSubst += substituicoes;
      ficheirosAfectados++;
    }
  }
  console.log(`\n[DRY-RUN] ${mapaPath.size} ficheiros seriam renomeados.`);
  console.log(`[DRY-RUN] ${totalSubst} referências em ${ficheirosAfectados} ficheiros seriam actualizadas.`);
  process.exit(0);
}

// --- Renomear ficheiros ---
console.log('A renomear ficheiros...');
for (const [oldPath, newPath] of mapaPath) {
  fs.renameSync(oldPath, newPath);
}
console.log(`  ${mapaPath.size} ficheiros renomeados.\n`);

// --- Actualizar referências ---
const ficheirosTexto = listarFicheirosTexto([SRC_DIR], ['.md', '.njk', '.json']);

console.log(`A actualizar referências em ${ficheirosTexto.length} ficheiros candidatos...`);
let ficheirosActualizados = 0;
let totalSubstituicoes = 0;

for (const f of ficheirosTexto) {
  const { conteudo, substituicoes } = actualizarFicheiro(f, mapaUrl);
  if (substituicoes > 0) {
    fs.writeFileSync(f, conteudo, 'utf8');
    ficheirosActualizados++;
    totalSubstituicoes += substituicoes;
  }
}

console.log(`  ${totalSubstituicoes} referências actualizadas em ${ficheirosActualizados} ficheiros.\n`);

console.log('=== Concluído ===');
console.log(`  Renomeados:   ${mapaPath.size}`);
console.log(`  Referências:  ${totalSubstituicoes} em ${ficheirosActualizados} ficheiros`);
