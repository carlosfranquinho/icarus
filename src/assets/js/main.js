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
// Nota: o plugin de imagens envolve <img> em <picture>, por isso pesquisamos
// tanto "p > picture > img" como "p > img" para compatibilidade futura.
// Nas páginas de espécies, .post-corpo tem também a classe .content-especie:
// nesse caso ignoramos aqui e deixamos o handler de espécies tratar do conteúdo.
document.addEventListener("DOMContentLoaded", () => {
  const corpo = document.querySelector(".post-corpo");
  if (!corpo || corpo.classList.contains("content-especie")) return;

  corpo.querySelectorAll("p > picture > img, p > img").forEach(img => {
    const pImg = img.closest("p");
    // Mover o <picture> wrapper se existir, ou o <img> diretamente
    const imgToMove = (img.parentElement.tagName === "PICTURE") ? img.parentElement : img;
    const nextEl = pImg.nextElementSibling;
    const figure = document.createElement("figure");
    figure.className = "post-figura";
    pImg.parentNode.insertBefore(figure, pImg);
    figure.appendChild(imgToMove);
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

  // Deteção de mapas de distribuição: antes usava img.src.includes(".png"),
  // mas após a otimização os src são JPEG. Usa-se o alt text como critério.
  const allImages = isEspecie.querySelectorAll("img");
  allImages.forEach(img => {
    const alt = img.alt.toLowerCase();
    if (alt.includes("mapa") || alt.includes("distribuiç") || alt.includes("distribui")) {
      img.classList.add("mapa-distribuicao");
    }
  });

  // Mover o mapa de distribuição para ao lado do texto da secção Distribuição
  const mapaImg = isEspecie.querySelector(".mapa-distribuicao");
  if (mapaImg) {
    const mapa = (mapaImg.parentElement.tagName === "PICTURE") ? mapaImg.parentElement : mapaImg;
    const h3Dist = Array.from(isEspecie.querySelectorAll("h3"))
      .find(h => h.textContent.includes("Distribuição"));
    if (h3Dist) {
      const pMapa = mapa.closest("p");
      h3Dist.insertAdjacentElement("afterend", mapa);
      if (pMapa && !pMapa.textContent.trim()) pMapa.remove();
    }
  }

  // Converter pares imagem + parágrafo seguinte em <figure> + <figcaption>
  isEspecie.querySelectorAll("p > picture > img:not(.mapa-distribuicao), p > img:not(.mapa-distribuicao)").forEach(img => {
    const pImg = img.closest("p");
    const imgToMove = (img.parentElement.tagName === "PICTURE") ? img.parentElement : img;
    const nextEl = pImg.nextElementSibling;
    const wrap = document.createElement("div");
    wrap.className = "especie-figura-wrap";
    const figure = document.createElement("figure");
    figure.className = "especie-figura";
    pImg.parentNode.insertBefore(wrap, pImg);
    wrap.appendChild(figure);
    figure.appendChild(imgToMove);
    pImg.remove();
    if (nextEl && nextEl.tagName === "P" && !nextEl.querySelector("img, picture")) {
      const figcaption = document.createElement("figcaption");
      figcaption.innerHTML = nextEl.innerHTML;
      figure.appendChild(figcaption);
      nextEl.remove();
    }
  });

});
