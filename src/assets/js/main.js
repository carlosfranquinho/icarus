// Nav mobile toggle
const toggle = document.querySelector('.nav-toggle');
const lista = document.querySelector('.nav-lista');

if (toggle && lista) {
  toggle.addEventListener('click', () => {
    const aberta = lista.classList.toggle('aberta');
    toggle.setAttribute('aria-expanded', aberta);
  });

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
    nav.classList.toggle('scrolled', window.scrollY > 50);
  });
}

// Formatacao do conteudo das especies
document.addEventListener("DOMContentLoaded", () => {
  const isEspecie = document.querySelector(".content-especie");
  if (!isEspecie) return;

  const allImages = isEspecie.querySelectorAll("img");
  allImages.forEach(img => {
    if (img.src.includes(".png") || img.src.includes("map")) {
      img.classList.add("mapa-distribuicao");
    } else {
      const pContainer = img.closest("p");
      if (pContainer && !pContainer.closest('.especies-relacionadas-grelha')) {
        const figure = document.createElement("figure");
        figure.className = "especie-figura";
      }
    }
  });

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
