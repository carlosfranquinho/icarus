module.exports = function (eleventyConfig) {
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
