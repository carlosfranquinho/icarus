const Image = require("@11ty/eleventy-img");
const path = require("path");

async function imageShortcode(src, alt, className = "", sizes = "100vw") {
  if(alt === undefined) {
    throw new Error(`Missing \`alt\` on myImage from: ${src}`);
  }
  
  // Handling relative src paths like /imagens/... 
  let imageSrc = src;
  if (src.startsWith("/")) {
    imageSrc = path.join(__dirname, src);
  }

  try {
    let metadata = await Image(imageSrc, {
      widths: [300, 600, 1200],
      formats: ["avif", "webp", "jpeg"],
      outputDir: "./_site/img/",
      urlPath: "/img/"
    });

    let imageAttributes = {
      alt,
      sizes,
      loading: "lazy",
      decoding: "async",
    };
    if (className) {
      imageAttributes.class = className;
    }

    return Image.generateHTML(metadata, imageAttributes);
  } catch (e) {
    console.error(`Aviso: Falha ao otimizar a imagem ${src}. Fallback HTML usado. erro: ${e.message}`);
    const classAttr = className ? ` class="${className}"` : "";
    return `<img src="${src}" alt="${alt}"${classAttr} loading="lazy" decoding="async">`;
  }
}

module.exports = function (eleventyConfig) {
  eleventyConfig.addNunjucksAsyncShortcode("image", imageShortcode);
  eleventyConfig.addLiquidShortcode("image", imageShortcode);
  eleventyConfig.addJavaScriptFunction("image", imageShortcode);
  
  // Passthrough copies
  eleventyConfig.addPassthroughCopy("imagens");
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

  // Filter: slice genérico
  eleventyConfig.addFilter("slice", (arr, n) => (arr || []).slice(0, n));

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
