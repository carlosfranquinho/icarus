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
    }
  });

  // Mover o mapa de distribuição para ao lado do texto da secção Distribuição
  const mapa = isEspecie.querySelector(".mapa-distribuicao");
  if (mapa) {
    const h3Dist = Array.from(isEspecie.querySelectorAll("h3"))
      .find(h => h.textContent.includes("Distribuição"));
    if (h3Dist) {
      const pMapa = mapa.closest("p");
      h3Dist.insertAdjacentElement("afterend", mapa);
      if (pMapa && !pMapa.textContent.trim()) pMapa.remove();
    }
  }

});
