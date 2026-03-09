```javascript
// Nav mobile toggle
const toggle = document.querySelector('.nav-toggle');
const lista = document.querySelector('.nav-lista');

if (toggle && lista) {
  toggle.addEventListener('click', () => {
    const aberta = lista.classList.toggle('aberta');
    toggle.setAttribute('aria-expanded', aberta);
  });

  // Close on outside click
  document.addEventListener('click', (e) => {
    if (!toggle.contains(e.target) && !lista.contains(e.target)) {
      lista.classList.remove('aberta');
      toggle.setAttribute('aria-expanded', 'false');
    }
  });
}

// Sticky nav transparency toggle for homepage
const nav = document.querySelector('.nav-principal');
if (nav && document.body.classList.contains('is-home')) {
  window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
      nav.classList.add('scrolled');
    } else {
      nav.classList.remove('scrolled');
    }
  });
}

// Formatacao do conteudo das especies
document.addEventListener("DOMContentLoaded", () => {
  const isEspecie = document.querySelector(".content-especie");
  if (!isEspecie) return;

  // 1. Mapas
  // Normalmente os mapas têm .png no src ou "map"
  const allImages = isEspecie.querySelectorAll("img");
  allImages.forEach(img => {
    if (img.src.includes(".png") || img.src.includes("map")) {
      img.classList.add("mapa-distribuicao");
    } else {
      // 3. Moldura e legenda para fotos normais
      const pContainer = img.closest("p");
      if (pContainer && !pContainer.closest('.especies-relacionadas-grelha')) {
        let captionP = pContainer.nextElementSibling;
        
        const figure = document.createElement("figure");
        figure.className = "especie-figura";


  // 4. Parágrafo Sumário - Puxar para baixo do card as frases introdutórias originais
  const fichaNode = document.querySelector(".especie-dados-ficha");
  const paragrafos = Array.from(isEspecie.querySelectorAll("p"));
  let i = 0;
  while (i < paragrafos.length) {
     let text = paragrafos[i].textContent.trim();
     if (text.length > 30 && text.indexOf("A ") === 0) {
         if (fichaNode && text.length < 500) { 
             const cloneInfo = paragrafos[i].cloneNode(true);
             cloneInfo.className = "especie-resumo-intro";
             fichaNode.insertAdjacentElement('afterend', cloneInfo);
             paragrafos[i].remove();
         }
         break; 
     }
     i++;
  }

});
```
