#!/usr/bin/env node
/**
 * gbif-preencher-taxonomia.js
 *
 * Para cada ficha de espécie (tipo: especie):
 *  1. Consulta GBIF species/match + species/{key} → preenche `autoridade`
 *  2. Lookup genus → subfamília via tabela interna → preenche `subfamilia`
 *
 * Uso:
 *   node ferramentas/gbif-preencher-taxonomia.js             # dry-run
 *   node ferramentas/gbif-preencher-taxonomia.js --apply     # escreve ficheiros
 *   node ferramentas/gbif-preencher-taxonomia.js --only-missing  # só fichas sem ambos
 *   node ferramentas/gbif-preencher-taxonomia.js src/especies/diurnas/papilionidae/papilio-machaon.md
 */

'use strict';
const fs   = require('fs');
const path = require('path');
const https = require('https');

const APPLY        = process.argv.includes('--apply');
const ONLY_MISSING = process.argv.includes('--only-missing');
const ESPECIES_DIR = path.join(__dirname, '../src/especies');
const GBIF_DELAY   = 350; // ms entre chamadas à API

// ── Genus → Subfamília ───────────────────────────────────────────────────────
// Fonte: classificação actual de Lepidoptera (van Nieukerken et al. 2011,
// Zahiri et al. 2011/2012, Karsholt & van Nieukerken 2013)
const SUBFAMILIA_MAP = {
  // PAPILIONIDAE
  Papilio:       'Papilioninae',
  Iphiclides:    'Papilioninae',
  Zerynthia:     'Zerynthiinae',
  Allancastria:  'Zerynthiinae',
  // PIERIDAE
  Pieris:        'Pierinae',
  Pontia:        'Pierinae',
  Euchloe:       'Pierinae',
  Anthocharis:   'Pierinae',
  Aporia:        'Pierinae',
  Colias:        'Coliadinae',
  Gonepteryx:    'Coliadinae',
  Leptidea:      'Dismorphiinae',
  // NYMPHALIDAE
  Vanessa:       'Nymphalinae',
  Aglais:        'Nymphalinae',
  Nymphalis:     'Nymphalinae',
  Polygonia:     'Nymphalinae',
  Melitaea:      'Nymphalinae',
  Euphydryas:    'Nymphalinae',
  Araschnia:     'Nymphalinae',
  Argynnis:      'Heliconiinae',
  Boloria:       'Heliconiinae',
  Issoria:       'Heliconiinae',
  Charaxes:      'Charaxinae',
  Pararge:       'Satyrinae',
  Lasiommata:    'Satyrinae',
  Pyronia:       'Satyrinae',
  Maniola:       'Satyrinae',
  Melanargia:    'Satyrinae',
  Hipparchia:    'Satyrinae',
  Coenonympha:   'Satyrinae',
  Minois:        'Satyrinae',
  // LYCAENIDAE
  Lycaena:       'Lycaeninae',
  Satyrium:      'Theclinae',
  Callophrys:    'Theclinae',
  Tomares:       'Theclinae',
  Laeosopis:     'Theclinae',
  Favonius:      'Theclinae',
  Polyommatus:   'Polyommatinae',
  Aricia:        'Polyommatinae',
  Lampides:      'Polyommatinae',
  Leptotes:      'Polyommatinae',
  Cacyreus:      'Polyommatinae',
  Celastrina:    'Polyommatinae',
  Cupido:        'Polyommatinae',
  Glaucopsyche:  'Polyommatinae',
  Pseudophilotes:'Polyommatinae',
  Zizeeria:      'Polyommatinae',
  Plebejus:      'Polyommatinae',
  // HESPERIIDAE
  Thymelicus:    'Hesperiinae',
  Ochlodes:      'Hesperiinae',
  Hesperia:      'Hesperiinae',
  Pyrgus:        'Pyrginae',
  Spialia:       'Pyrginae',
  Muschampia:    'Pyrginae',
  Carcharodus:   'Pyrginae',
  Erynnis:       'Pyrginae',
  // SPHINGIDAE
  Acherontia:    'Sphinginae',
  Agrius:        'Sphinginae',
  Sphinx:        'Sphinginae',
  Mimas:         'Smerinthinae',
  Smerinthus:    'Smerinthinae',
  Laothoe:       'Smerinthinae',
  Deilephila:    'Macroglossinae',
  Hyles:         'Macroglossinae',
  Macroglossum:  'Macroglossinae',
  Hippotion:     'Macroglossinae',
  Hemaris:       'Macroglossinae',
  // NOTODONTIDAE
  Phalera:       'Phalerinae',
  Thaumetopoea:  'Thaumetopoeinae',
  Drymonia:      'Notodontinae',
  Pterostoma:    'Notodontinae',
  Harpyia:       'Cerurinae',
  Stauropus:     'Stauropinae',
  // EREBIDAE
  Catocala:      'Erebinae',
  Dysgonia:      'Erebinae',
  Scoliopteryx:  'Erebinae',
  Cerocala:      'Erebinae',
  Parascotia:    'Erebinae',
  Odice:         'Erebinae',
  Eublemma:      'Eublemminae',
  Rivula:        'Rivulinae',
  Polypogon:     'Herminiinae',
  Herminia:      'Herminiinae',
  Hypena:        'Herminiinae',
  Lymantria:     'Lymantriinae',
  Orgyia:        'Lymantriinae',
  Sphrageidus:   'Lymantriinae',
  Calliteara:    'Lymantriinae',
  Euproctis:     'Lymantriinae',
  Arctia:        'Arctiinae',
  Brithys:       'Arctiinae',
  Coscinia:      'Arctiinae',
  Cymbalophora:  'Arctiinae',
  Eilema:        'Arctiinae',
  Lithosia:      'Arctiinae',
  Miltochrista:  'Arctiinae',
  Paidia:        'Arctiinae',
  Phragmatobia:  'Arctiinae',
  Spilarctia:    'Arctiinae',
  Spilosoma:     'Arctiinae',
  Spiris:        'Arctiinae',
  Utetheisa:     'Arctiinae',
  // NOCTUIDAE
  Agrotis:       'Noctuinae',
  Noctua:        'Noctuinae',
  Ochropleura:   'Noctuinae',
  Xestia:        'Noctuinae',
  Cerastis:      'Noctuinae',
  Lycophotia:    'Noctuinae',
  Peridroma:     'Noctuinae',
  Eugnorisma:    'Noctuinae',
  Mamestra:      'Hadeninae',
  Lacanobia:     'Hadeninae',
  Mythimna:      'Hadeninae',
  Leucania:      'Hadeninae',
  Hadena:        'Hadeninae',
  Hecatera:      'Hadeninae',
  Anarta:        'Hadeninae',
  Sesamia:       'Hadeninae',
  Helicoverpa:   'Heliothinae',
  Heliothis:     'Heliothinae',
  Autographa:    'Plusiinae',
  Chrysodeixis:  'Plusiinae',
  Ctenoplusia:   'Plusiinae',
  Macdunnoughia: 'Plusiinae',
  Thysanoplusia: 'Plusiinae',
  Trichoplusia:  'Plusiinae',
  Bena:          'Plusiinae',
  Cucullia:      'Cuculliinae',
  Calophasia:    'Cuculliinae',
  Agrochola:     'Xyleninae',
  Conistra:      'Xyleninae',
  Polymixis:     'Xyleninae',
  Xylocampa:     'Xyleninae',
  Aporophyla:    'Xyleninae',
  Mormo:         'Xyleninae',
  Mniotype:      'Xyleninae',
  Thalpophila:   'Xyleninae',
  Ammopolia:     'Xyleninae',
  Phlogophora:   'Amphipyrinae',
  Euplexia:      'Amphipyrinae',
  Colocasia:     'Pantheinae',
  Acronicta:     'Acronictinae',
  Athetis:       'Condicinae',
  Caradrina:     'Condicinae',
  Hoplodrina:    'Condicinae',
  Spodoptera:    'Hadeninae',
  Pseudenargia:  'Xyleninae',
  Polyphaenis:   'Amphipyrinae',
  Elaphria:      'Condicinae',
  Callopistria:  'Condicinae',
  Xylocampa:     'Xyleninae',
  Nyctobrya:     'Erebinae',
  Psaphida:      'Psaphidinae',
  // GEOMETRIDAE
  Idaea:         'Sterrhinae',
  Scopula:       'Sterrhinae',
  Rhodometra:    'Sterrhinae',
  Timandra:      'Sterrhinae',
  Cyclophora:    'Sterrhinae',
  Rhodostrophia: 'Sterrhinae',
  Eupithecia:    'Larentiinae',
  Chloroclystis: 'Larentiinae',
  Chloroclysta:  'Larentiinae',
  Gymnoscelis:   'Larentiinae',
  Pasiphila:     'Larentiinae',
  Perizoma:      'Larentiinae',
  Scotopteryx:   'Larentiinae',
  Catarhoe:      'Larentiinae',
  Camptogramma:  'Larentiinae',
  Costaconvexa:  'Larentiinae',
  Orthonama:     'Larentiinae',
  Xanthorhoe:    'Larentiinae',
  Chesias:       'Larentiinae',
  Aplocera:      'Larentiinae',
  Hemithea:      'Geometrinae',
  Jodis:         'Geometrinae',
  Comibaena:     'Geometrinae',
  Pseudoterpna:  'Geometrinae',
  Thalera:       'Geometrinae',
  Phaiogramma:   'Geometrinae',
  Xenochlorodes: 'Geometrinae',
  Abraxas:       'Ennominae',
  Agriopis:      'Ennominae',
  Aleucis:       'Ennominae',
  Anthometra:    'Ennominae',
  Aspitates:     'Ennominae',
  Bostra:        'Ennominae',
  Cabera:        'Ennominae',
  Campaea:       'Ennominae',
  Chemerina:     'Ennominae',
  Cleonymia:     'Ennominae',
  Crocallis:     'Ennominae',
  Dyscia:        'Ennominae',
  Ectropis:      'Ennominae',
  Ematurga:      'Ennominae',
  Ennomos:       'Ennominae',
  Hypomecis:     'Ennominae',
  Itame:         'Ennominae',
  Lycia:         'Ennominae',
  Menophra:      'Ennominae',
  Nychiodes:     'Ennominae',
  Opisthograptis:'Ennominae',
  Pachycnemia:   'Ennominae',
  Peribatodes:   'Ennominae',
  Petrophora:    'Ennominae',
  Rhoptria:      'Ennominae',
  Selenia:       'Ennominae',
  Stegania:      'Ennominae',
  Tephronia:     'Ennominae',
  Adactylotis:   'Ennominae',
  // CRAMBIDAE
  Pyrausta:      'Pyraustinae',
  Anania:        'Pyraustinae',
  Eurrhypis:     'Pyraustinae',
  Mecyna:        'Pyraustinae',
  Loxostege:     'Pyraustinae',
  Evergestis:    'Glaphyriinae',
  Diasemia:      'Pyraustinae',
  Herpetogramma: 'Spilomelinae',
  Nomophila:     'Spilomelinae',
  Palpita:       'Spilomelinae',
  Udea:          'Spilomelinae',
  Synaphe:       'Spilomelinae',
  Eudonia:       'Scopariinae',
  Platytes:      'Crambinae',
  Catoptria:     'Crambinae',
  Angustalius:   'Crambinae',
  Arnia:         'Crambinae',
  Hyperlais:     'Scopariinae',
  // PYRALIDAE
  Acrobasis:     'Phycitinae',
  Anerastia:     'Phycitinae',
  Epischnia:     'Phycitinae',
  Homoeosoma:    'Phycitinae',
  Pempelia:      'Phycitinae',
  Endotricha:    'Pyralinae',
  Pyralis:       'Pyralinae',
  // TORTRICIDAE
  Acleris:       'Tortricinae',
  Cacoecimorpha: 'Tortricinae',
  Lozotaenia:    'Tortricinae',
  Cydia:         'Olethreutinae',
  Eucosma:       'Olethreutinae',
  Lobesia:       'Olethreutinae',
  Retinia:       'Olethreutinae',
  Cochylidia:    'Cochylinae',
  Phtheochroa:   'Cochylinae',
  Hysterophora:  'Cochylinae',
  // LASIOCAMPIDAE
  Lasiocampa:    'Lasiocampinae',
  Macrothylacia: 'Lasiocampinae',
  Malacosoma:    'Lasiocampinae',
  Phyllodesma:   'Lasiocampinae',
  Psilogaster:   'Lasiocampinae',
  // SATURNIIDAE
  Saturnia:      'Saturniinae',
  // ZYGAENIDAE
  Zygaena:       'Zygaeninae',
  // SESIIDAE
  Bembecia:      'Sesiinae',
  Pyropteron:    'Sesiinae',
  // COSSIDAE
  Zeuzera:       'Cossinae',
  // DREPANIDAE
  Drepana:       'Drepaninae',
  Watsonalla:    'Drepaninae',
  Tethea:        'Thyatirinae',
  Cymatophorina: 'Thyatirinae',
  Thyatira:      'Thyatirinae',
  // NOLIDAE
  Nola:          'Nolinae',
  Meganola:      'Nolinae',
  Earias:        'Chloephorinae',
  Pseudoips:     'Chloephorinae',
  // Géneros ibéricos/específicos
  Gerinia:       'Sterrhinae',
  Lenisa:        'Xyleninae',
  Neurotomia:    'Phycitinae',
  Ocneria:       'Lymantriinae',
  Oporopsamma:   'Olethreutinae',
  Orthosia:      'Hadeninae',
  Tyta:          'Acontiinae',
  Unchelea:      'Hadeninae',
  // HEPIALIDAE
  Triodia:       'Hepialinae',
  // LIMACODIDAE
  Hoyosia:       'Limacodinae',
};

// ── Utilitários ──────────────────────────────────────────────────────────────
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'grupo-icarus/1.0 (lepidoptera field records; nodejs)' } }, res => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch(e) { reject(new Error('JSON parse error: ' + data.slice(0, 80))); }
      });
    }).on('error', reject);
  });
}

async function gbifAutoridade(nomeCientifico) {
  try {
    // Tenta primeiro com strict=true; fallback com strict=false (útil para subespécies)
    for (const strict of ['true', 'false']) {
      const match = await httpsGet(
        `https://api.gbif.org/v1/species/match?name=${encodeURIComponent(nomeCientifico)}&strict=${strict}`
      );
      if (match.usageKey) {
        const detail = await httpsGet(`https://api.gbif.org/v1/species/${match.usageKey}`);
        if (detail.authorship) return detail.authorship;
      }
      if (strict === 'true') await sleep(GBIF_DELAY);
    }
    return null;
  } catch(e) {
    return null;
  }
}

function lerFicheiros(dir) {
  const ficheiros = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fp = path.join(dir, entry.name);
    if (entry.isDirectory()) ficheiros.push(...lerFicheiros(fp));
    else if (entry.name.endsWith('.md')) ficheiros.push(fp);
  }
  return ficheiros;
}

function parseFrontmatter(conteudo) {
  const m = conteudo.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return null;
  const campos = {};
  for (const linha of m[1].split(/\r?\n/)) {
    const idx = linha.indexOf(':');
    if (idx < 0) continue;
    const k = linha.slice(0, idx).trim();
    const v = linha.slice(idx + 1).trim().replace(/^"(.*)"$/, '$1');
    campos[k] = v;
  }
  return { campos, fmRaw: m[1], fmFull: m[0] };
}

function setFrontmatterField(conteudo, campo, valor) {
  const parsed = parseFrontmatter(conteudo);
  if (!parsed) return conteudo;
  const { fmRaw } = parsed;

  // Já existe o campo → substituir
  const regex = new RegExp(`^(${campo}:\\s*).*$`, 'm');
  if (regex.test(fmRaw)) {
    const novoFm = fmRaw.replace(regex, `$1"${valor}"`);
    return conteudo.replace(fmRaw, novoFm);
  }

  // Não existe → inserir depois de 'familia' se possível, senão antes do primeiro campo vazio
  const novoFm = fmRaw.replace(
    /^(familia:.*)$/m,
    `$1\n${campo}: "${valor}"`
  );
  if (novoFm !== fmRaw) return conteudo.replace(fmRaw, novoFm);

  // Fallback: adicionar no fim do frontmatter
  return conteudo.replace(fmRaw, fmRaw + `\n${campo}: "${valor}"`);
}

// ── Main ─────────────────────────────────────────────────────────────────────
(async () => {
  // Ficheiros explícitos como args, ou todos
  const args = process.argv.slice(2).filter(a => !a.startsWith('--'));
  const ficheiros = args.length
    ? args.map(a => path.resolve(a))
    : lerFicheiros(ESPECIES_DIR).filter(f => !f.endsWith('/') );

  const resultados = [];
  let nGbif = 0, nSubfam = 0, nSemAutoridade = 0, nSemSubfam = 0;

  for (const fp of ficheiros) {
    const conteudo = fs.readFileSync(fp, 'utf8');
    const parsed = parseFrontmatter(conteudo);
    if (!parsed) continue;
    const { campos } = parsed;
    if (campos.tipo !== 'especie') continue;

    const nome = campos.nome_cientifico;
    if (!nome) continue;

    const temAutoridade = !!campos.autoridade;
    const temSubfamilia = !!campos.subfamilia;

    if (ONLY_MISSING && (temAutoridade && temSubfamilia)) continue;

    const genus = nome.split(' ')[0];
    const subfamiliaLookup = SUBFAMILIA_MAP[genus] || null;

    process.stdout.write(`  ${nome.padEnd(40)}`);

    // GBIF para autoridade
    let novaAutoridade = null;
    if (!temAutoridade) {
      novaAutoridade = await gbifAutoridade(nome);
      await sleep(GBIF_DELAY);
      if (novaAutoridade) {
        nGbif++;
        process.stdout.write(`  aut: "${novaAutoridade}"`);
      } else {
        nSemAutoridade++;
        process.stdout.write(`  aut: ?`);
      }
    } else {
      process.stdout.write(`  aut: (já existe)`);
    }

    // Subfamília por lookup
    let novaSubfamilia = null;
    if (!temSubfamilia) {
      novaSubfamilia = subfamiliaLookup;
      if (novaSubfamilia) {
        nSubfam++;
        process.stdout.write(`  sub: "${novaSubfamilia}"`);
      } else {
        nSemSubfam++;
        process.stdout.write(`  sub: ?`);
      }
    } else {
      process.stdout.write(`  sub: (já existe)`);
    }

    process.stdout.write('\n');

    resultados.push({ fp, conteudo, novaAutoridade, novaSubfamilia, nome });
  }

  // Aplicar se --apply
  if (APPLY) {
    let escritos = 0;
    for (const { fp, conteudo, novaAutoridade, novaSubfamilia } of resultados) {
      let novo = conteudo;
      if (novaAutoridade) novo = setFrontmatterField(novo, 'autoridade', novaAutoridade);
      if (novaSubfamilia) novo = setFrontmatterField(novo, 'subfamilia', novaSubfamilia);
      if (novo !== conteudo) {
        fs.writeFileSync(fp, novo, 'utf8');
        escritos++;
      }
    }
    console.log(`\n✓ ${escritos} ficheiros actualizados.`);
  } else {
    console.log('\n(dry-run — adiciona --apply para escrever os ficheiros)');
  }

  // Resumo
  console.log(`\nResumo:`);
  console.log(`  Autoridade via GBIF: ${nGbif} encontradas, ${nSemAutoridade} não encontradas`);
  console.log(`  Subfamília via lookup: ${nSubfam} encontradas, ${nSemSubfam} não encontradas`);

  if (nSemSubfam > 0) {
    console.log('\nGéneros sem subfamília mapeada:');
    const semSub = resultados
      .filter(r => !r.novaSubfamilia && !parseFrontmatter(r.conteudo)?.campos?.subfamilia)
      .map(r => r.nome.split(' ')[0]);
    [...new Set(semSub)].sort().forEach(g => console.log(`  ${g}`));
  }
})();
