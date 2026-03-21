const Image = require("@11ty/eleventy-img");
const path = require("path");
const fs = require("fs");
const markdownIt = require("markdown-it");
const md = markdownIt({ html: false });

// Mapa nome_cientifico → permalink, construído uma vez no arranque
function buildEspeciesMap() {
  const map = new Map();
  for (const grupo of ["diurnas", "noturnas", "micro"]) {
    const base = `src/especies/${grupo}`;
    if (!fs.existsSync(base)) continue;
    for (const familia of fs.readdirSync(base)) {
      const dir = path.join(base, familia);
      if (!fs.statSync(dir).isDirectory()) continue;
      for (const file of fs.readdirSync(dir)) {
        if (!file.endsWith(".md")) continue;
        const raw = fs.readFileSync(path.join(dir, file), "utf8");
        const fm = raw.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? "";
        const nome = fm.match(/nome_cientifico:\s*["']?([^"'\n]+)["']?/)?.[1]?.trim();
        const permalink = fm.match(/permalink:\s*["']?([^"'\n]+)["']?/)?.[1]?.trim();
        const tipo = fm.match(/tipo:\s*["']?([^"'\n]+)["']?/)?.[1]?.trim();
        if (nome && permalink && tipo === "especie") map.set(nome, permalink);
      }
    }
  }
  return map;
}
const especiesMap = buildEspeciesMap();

async function imageShortcode(src, alt, className = "", sizes = "100vw") {
  if (!src) return "";

  // SVGs: não processar, devolver <img> simples
  if (src.endsWith(".svg")) {
    const classAttr = className ? ` class="${className}"` : "";
    return `<img src="${src}" alt="${alt || ""}"${classAttr} loading="lazy" decoding="async">`;
  }

  let imageSrc = src;
  if (src.startsWith("/")) {
    imageSrc = path.join(__dirname, src);
  }

  try {
    const metadata = await Image(imageSrc, {
      widths: [300, 600, 1200],
      formats: ["avif", "webp", "jpeg"],
      outputDir: "./_site/img/",
      urlPath: "/img/",
    });
    const attrs = { alt: alt || "", sizes, loading: "lazy", decoding: "async" };
    if (className) attrs.class = className;
    return Image.generateHTML(metadata, attrs);
  } catch (e) {
    console.error(`Aviso: falha ao otimizar ${src}: ${e.message}`);
    const classAttr = className ? ` class="${className}"` : "";
    return `<img src="${src}" alt="${alt || ""}"${classAttr} loading="lazy" decoding="async">`;
  }
}

module.exports = function (eleventyConfig) {
  eleventyConfig.addNunjucksAsyncShortcode("image", imageShortcode);
  // Passthrough copies
  eleventyConfig.addPassthroughCopy({"src/_data/observacoes.json": "dados/observacoes.json"});
  eleventyConfig.addPassthroughCopy("imagens");
  eleventyConfig.addPassthroughCopy("src/assets/places");
  eleventyConfig.addPassthroughCopy("src/assets");
  eleventyConfig.addPassthroughCopy("CNAME");

  // Portuguese date filter
  eleventyConfig.addFilter("dataPortugues", (dateObj) => {
    const meses = [
      "janeiro", "fevereiro", "março", "abril", "maio", "junho",
      "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
    ];
    const d = new Date(dateObj);
    return `${d.getUTCDate()} de ${meses[d.getUTCMonth()]} de ${d.getUTCFullYear()}`;
  });

  eleventyConfig.addFilter("htmlDateString", (dateObj) => {
    const d = new Date(dateObj);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
  });

  // Filter: filtra uma collection por família
  eleventyConfig.addFilter("porFamilia", (colecao, familia) => {
    if (!familia) return [];
    const fStr = String(familia).toLowerCase().trim();
    return (colecao || []).filter((item) => {
      if (!item.data || !item.data.familia) return false;
      return String(item.data.familia).toLowerCase().trim() === fStr;
    });
  });

  // Filter: renderiza Markdown inline (para descricao no frontmatter)
  eleventyConfig.addFilter("markdownify", (str) => {
    if (!str) return "";
    return md.renderInline(String(str));
  });

  // Filter: slice genérico
  eleventyConfig.addFilter("slice", (arr, n) => (arr || []).slice(0, n));

  // Filter: gera JSON {nome_cientifico: url} para as espécies (usado em observacoes.njk)
  eleventyConfig.addFilter("especieUrlsJson", (colecao) => {
    const map = {};
    (colecao || []).forEach(esp => {
      if (esp.data && esp.data.tipo === "especie" && esp.data.nome_cientifico) {
        map[esp.data.nome_cientifico] = esp.url;
      }
    });
    return JSON.stringify(map);
  });

  // Filter: gera JSON {nome_cientifico: familia} para as espécies (usado em observacoes.njk)
  eleventyConfig.addFilter("familiaMapJson", (colecao) => {
    const map = {};
    (colecao || []).forEach(esp => {
      if (esp.data && esp.data.tipo === "especie" && esp.data.nome_cientifico && esp.data.familia) {
        map[esp.data.nome_cientifico] = esp.data.familia;
      }
    });
    return JSON.stringify(map);
  });

  // Filter: gera JSON {titulo: {grupo, url, imagem, cor_thumb}} para as famílias
  eleventyConfig.addFilter("familiaMetaJson", (colecao) => {
    const map = {};
    (colecao || []).forEach(fam => {
      if (fam.data && fam.data.tipo === "familia" && fam.data.title) {
        map[fam.data.title] = {
          grupo:    fam.data.grupo     || null,
          url:      fam.url            || null,
          imagem:   fam.data.imagem    || null,
          corFundo: fam.data.cor_thumb || null,
        };
      }
    });
    return JSON.stringify(map);
  });

  // Filter: gera JSON {nome_cientifico: {grupo, familia}} para as páginas de estatísticas
  eleventyConfig.addFilter("especieMetaJson", (colecao) => {
    const map = {};
    (colecao || []).forEach(esp => {
      if (esp.data && esp.data.tipo === "especie" && esp.data.nome_cientifico) {
        map[esp.data.nome_cientifico] = {
          grupo:       esp.data.grupo        || null,
          familia:     esp.data.familia      || null,
          url:         esp.url               || null,
          imagem:      esp.data.imagem       || null,
          placeholder: esp.data.placeholder  || false,
        };
      }
    });
    return JSON.stringify(map);
  });

  // Filter: gera JSON { sinónimo → nome_cientifico_principal } para todas as fichas
  eleventyConfig.addFilter("sinonimosMapJson", (colecao) => {
    const map = {};
    (colecao || []).forEach(esp => {
      if (esp.data && esp.data.tipo === "especie" && esp.data.nome_cientifico) {
        for (const s of (esp.data.sinonimos || [])) {
          map[s] = esp.data.nome_cientifico;
        }
      }
    });
    return JSON.stringify(map);
  });

  // Filter: filtra observações por espécie (inclui sinónimos opcionais)
  eleventyConfig.addFilter("observacoesPorEspecie", (obs, nome, sinonimos) => {
    const nomes = new Set([nome, ...(sinonimos || [])]);
    return (obs || []).filter(o => nomes.has(o.nome_cientifico));
  });

  // Filter: total de observações de uma espécie incluindo sinónimos
  eleventyConfig.addFilter("totalObsEspecie", (especie, obsCount) => {
    let total = obsCount[especie.data.nome_cientifico] || 0;
    for (const s of (especie.data.sinonimos || [])) {
      total += obsCount[s] || 0;
    }
    return total;
  });

  // Filter: gera SVG do fenograma mensal (retorna string SVG)
  eleventyConfig.addFilter("svgFenograma", (obs) => {
    const counts = Array(12).fill(0);
    (obs || []).forEach(o => {
      if (o.data) {
        const m = parseInt(o.data.split("-")[1], 10) - 1;
        if (m >= 0 && m < 12) counts[m]++;
      }
    });
    const max = Math.max(...counts, 1);
    const meses = ["J","F","M","A","M","J","J","A","S","O","N","D"];
    const barW = 16, gap = 3, H = 48, labelH = 14, padL = 4;
    const W = 12 * (barW + gap) - gap + padL * 2;
    let bars = "";
    counts.forEach((c, i) => {
      const h = c > 0 ? Math.max(3, Math.round((c / max) * H)) : 2;
      const x = padL + i * (barW + gap);
      const y = H - h;
      const fill = c > 0 ? "#06b6d4" : "#e2e8f0";
      bars += `<rect x="${x}" y="${y}" width="${barW}" height="${h}" fill="${fill}" rx="2"/>`;
      bars += `<text x="${x + barW/2}" y="${H + labelH - 2}" text-anchor="middle" font-size="9" fill="#64748b" font-family="system-ui,sans-serif">${meses[i]}</text>`;
      if (c > 0) {
        bars += `<text x="${x + barW/2}" y="${y - 2}" text-anchor="middle" font-size="8" fill="#0891b2" font-family="system-ui,sans-serif">${c}</text>`;
      }
    });
    return `<svg width="${W}" height="${H + labelH}" viewBox="0 0 ${W} ${H + labelH}" role="img" aria-label="Fenograma de observações"><title>Fenograma mensal</title>${bars}</svg>`;
  });

  // Transform: converte pares <p><img></p> + <p>legenda</p> em <figure> + <figcaption>
  eleventyConfig.addTransform("figcaptions", function(content, outputPath) {
    if (!outputPath || !outputPath.endsWith(".html")) return content;

    // Posts: figcaptions + substituição de links antigos + auto-linkagem de espécies
    if (this.inputPath && this.inputPath.includes("src/posts/")) {
      // 1. Figcaptions
      content = content.replace(
        /<p>\s*(<img[^>]+>)\s*<\/p>\s*<p><em>([^<]+)<\/em><\/p>/g,
        '<figure class="post-figura">$1<figcaption>$2</figcaption></figure>'
      );
      // 2. Auto-ligar nomes de espécies em <em> ainda não dentro de <a>
      //    Alternação: consome <a>…</a> intactos; só substitui <em> soltos
      content = content.replace(
        /(<a\b[\s\S]*?<\/a>)|<em>([^<]+)<\/em>/g,
        (match, anchor, nome) => {
          if (anchor) return anchor;
          const permalink = especiesMap.get(nome);
          return permalink ? `<a href="${permalink}"><em>${nome}</em></a>` : match;
        }
      );
      return content;
    }

    // Espécies: legenda é qualquer parágrafo seguinte sem imagem
    if (this.inputPath && this.inputPath.includes("src/especies/")) {
      // Pass 1: imagem + legenda
      content = content.replace(
        /<p>\s*(<img[^>]+>)\s*<\/p>\s*<p>((?!<img|<picture)[^\n]+)<\/p>/g,
        '<div class="especie-figura-wrap"><figure class="especie-figura">$1<figcaption>$2</figcaption></figure></div>'
      );
      // Pass 2: imagem sem legenda
      content = content.replace(
        /<p>\s*(<img[^>]+>)\s*<\/p>/g,
        '<div class="especie-figura-wrap"><figure class="especie-figura">$1</figure></div>'
      );
      return content;
    }

    return content;
  });

  // Collections
  eleventyConfig.addCollection("posts", (collectionApi) => {
    return collectionApi
      .getFilteredByGlob("src/posts/**/*.md")
      .sort((a, b) => b.date - a.date);
  });

  eleventyConfig.addCollection("postsDiurnas", (collectionApi) => {
    return collectionApi
      .getFilteredByGlob("src/posts/**/*.md")
      .filter((p) => p.data.categoria === "diurnas")
      .sort((a, b) => b.date - a.date);
  });

  eleventyConfig.addCollection("postsNoturnas", (collectionApi) => {
    return collectionApi
      .getFilteredByGlob("src/posts/**/*.md")
      .filter((p) => p.data.categoria === "noturnas")
      .sort((a, b) => b.date - a.date);
  });

  eleventyConfig.addCollection("especies", (collectionApi) => {
    return collectionApi
      .getFilteredByGlob("src/especies/**/*.md")
      .filter((p) => p.data.tipo === "especie")
      .sort((a, b) => (a.data.nome_cientifico || "").localeCompare(b.data.nome_cientifico || ""));
  });

  eleventyConfig.addCollection("especiesDiurnas", (collectionApi) => {
    return collectionApi
      .getFilteredByGlob("src/especies/diurnas/**/*.md")
      .filter((p) => p.data.tipo === "especie")
      .sort((a, b) => (a.data.nome_cientifico || "").localeCompare(b.data.nome_cientifico || ""));
  });

  eleventyConfig.addCollection("especiesNoturnas", (collectionApi) => {
    return collectionApi
      .getFilteredByGlob("src/especies/noturnas/**/*.md")
      .filter((p) => p.data.tipo === "especie")
      .sort((a, b) => (a.data.nome_cientifico || "").localeCompare(b.data.nome_cientifico || ""));
  });

  eleventyConfig.addCollection("familiasDiurnas", (collectionApi) => {
    return collectionApi
      .getFilteredByGlob("src/especies/diurnas/**/*.md")
      .filter((p) => p.data.tipo === "familia");
  });

  eleventyConfig.addCollection("familiasNoturnas", (collectionApi) => {
    return collectionApi
      .getFilteredByGlob("src/especies/noturnas/**/*.md")
      .filter((p) => p.data.tipo === "familia");
  });

  eleventyConfig.addCollection("especiesMicro", (collectionApi) => {
    return collectionApi
      .getFilteredByGlob("src/especies/micro/**/*.md")
      .filter((p) => p.data.tipo === "especie")
      .sort((a, b) => (a.data.nome_cientifico || "").localeCompare(b.data.nome_cientifico || ""));
  });

  eleventyConfig.addCollection("familiasMicro", (collectionApi) => {
    return collectionApi
      .getFilteredByGlob("src/especies/micro/**/*.md")
      .filter((p) => p.data.tipo === "familia");
  });

  return {
    dir: {
      input: "src",
      output: "_site",
      includes: "_includes",
      data: "_data",
    },
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
    templateFormats: ["md", "njk", "html"],
  };
};
