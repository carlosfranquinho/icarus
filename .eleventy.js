const Image = require("@11ty/eleventy-img");
const path = require("path");
const markdownIt = require("markdown-it");
const md = markdownIt({ html: false });

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

  eleventyConfig.addFilter("anoMes", (dateObj) => {
    const d = new Date(dateObj);
    return `${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  });

  eleventyConfig.addFilter("ano", (dateObj) => {
    return new Date(dateObj).getUTCFullYear();
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

  // Filter: filtra observações por espécie
  eleventyConfig.addFilter("observacoesPorEspecie", (obs, nome) => {
    return (obs || []).filter(o => o.nome_cientifico === nome);
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

  // Filter: gera SVG do mapa UTM 1×1km (retorna string SVG)
  eleventyConfig.addFilter("svgMapaUTM", (obs) => {
    const COL = {J:0,K:1,L:2,M:3,N:4,P:5,Q:6,R:7};
    const ROW = {A:0,B:1,C:2,D:3,E:4,F:5,G:6,H:7,J:8,K:9,L:10,M:11,N:12,P:13,Q:14,R:15,S:16,T:17,U:18,V:19};
    const squareCounts = {};
    (obs || []).forEach(o => {
      if (o.utm1k && o.utm1k.length >= 6) {
        const col = o.utm1k[0];
        const row = o.utm1k[1];
        const e = parseInt(o.utm1k.substring(2, 4), 10);
        const n = parseInt(o.utm1k.substring(4, 6), 10);
        if (col in COL && row in ROW) {
          const absE = COL[col] * 100 + e;
          const absN = ROW[row] * 100 + n;
          const key = `${absE},${absN}`;
          squareCounts[key] = (squareCounts[key] || 0) + 1;
        }
      }
    });
    const keys = Object.keys(squareCounts);
    if (!keys.length) return "";
    const allE = keys.map(k => parseInt(k.split(",")[0]));
    const allN = keys.map(k => parseInt(k.split(",")[1]));
    const minE = Math.min(...allE) - 2;
    const maxE = Math.max(...allE) + 2;
    const minN = Math.min(...allN) - 2;
    const maxN = Math.max(...allN) + 2;
    const cellPx = 10;
    const cols = maxE - minE + 1;
    const rows = maxN - minN + 1;
    const W = cols * cellPx;
    const H = rows * cellPx;
    let rects = `<rect x="0" y="0" width="${W}" height="${H}" fill="#f8fafc"/>`;
    for (let e = minE; e <= maxE; e++) {
      for (let n = minN; n <= maxN; n++) {
        const x = (e - minE) * cellPx;
        const y = (maxN - n) * cellPx;
        rects += `<rect x="${x}" y="${y}" width="${cellPx}" height="${cellPx}" fill="#f1f5f9" stroke="#e2e8f0" stroke-width="0.5"/>`;
      }
    }
    Object.entries(squareCounts).forEach(([key, count]) => {
      const [ae, an] = key.split(",").map(Number);
      const x = (ae - minE) * cellPx;
      const y = (maxN - an) * cellPx;
      rects += `<rect x="${x}" y="${y}" width="${cellPx}" height="${cellPx}" fill="#06b6d4" stroke="#0891b2" stroke-width="0.5"><title>${count} obs.</title></rect>`;
    });
    return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Mapa UTM de observações" style="max-width:100%;height:auto;">${rects}</svg>`;
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
