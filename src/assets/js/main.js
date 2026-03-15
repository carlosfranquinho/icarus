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

// Rotacao aleatoria das silhuetas nos cards de familia
document.querySelectorAll('.card-familia-ficha-img img').forEach(img => {
  const deg = (Math.random() * 20 - 10).toFixed(1);
  img.style.transform = `rotate(${deg}deg)`;
});

// Legendas nas fotos dos posts (parágrafo em itálico a seguir a imagem → figcaption)
document.addEventListener("DOMContentLoaded", () => {
  const corpo = document.querySelector(".post-corpo");
  if (!corpo) return;

  corpo.querySelectorAll("p > img").forEach(img => {
    const pImg = img.closest("p");
    const nextEl = pImg.nextElementSibling;
    const figure = document.createElement("figure");
    figure.className = "post-figura";
    pImg.parentNode.insertBefore(figure, pImg);
    figure.appendChild(img);
    pImg.remove();
    if (nextEl && nextEl.tagName === "P" &&
        nextEl.children.length === 1 && nextEl.children[0].tagName === "EM") {
      const figcaption = document.createElement("figcaption");
      figcaption.innerHTML = nextEl.children[0].innerHTML;
      figure.appendChild(figcaption);
      nextEl.remove();
    }
  });
});

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

  // Converter pares imagem + parágrafo seguinte em <figure> + <figcaption>
  isEspecie.querySelectorAll("p > img:not(.mapa-distribuicao)").forEach(img => {
    const pImg = img.closest("p");
    const nextEl = pImg.nextElementSibling;
    const wrap = document.createElement("div");
    wrap.className = "especie-figura-wrap";
    const figure = document.createElement("figure");
    figure.className = "especie-figura";
    pImg.parentNode.insertBefore(wrap, pImg);
    wrap.appendChild(figure);
    figure.appendChild(img);
    pImg.remove();
    if (nextEl && nextEl.tagName === "P" && !nextEl.querySelector("img")) {
      const figcaption = document.createElement("figcaption");
      figcaption.innerHTML = nextEl.innerHTML;
      figure.appendChild(figcaption);
      nextEl.remove();
    }
  });

});
