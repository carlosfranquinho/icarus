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

  // Mover fenograma regional para depois do parágrafo "Período de voo em Portugal"
  const fenograma = document.getElementById('fenograma-regional');
  if (fenograma) {
    const strongPeriodo = Array.from(isEspecie.querySelectorAll('strong'))
      .find(el => el.textContent.includes('Período de voo em Portugal'));
    if (strongPeriodo) {
      const pPeriodo = strongPeriodo.closest('p');
      if (pPeriodo) {
        pPeriodo.after(fenograma);
        fenograma.style.display = '';
      }
    }
  }

  // Mover mapa de distribuição para a secção Distribuição
  const h3Dist = Array.from(isEspecie.querySelectorAll("h3"))
    .find(h => h.textContent.includes("Distribuição"));
  if (h3Dist) {
    const mapaContainer = document.getElementById("mapa-regional-container");
    if (mapaContainer) {
      // Temos mapa dinâmico: remover imagem estática (se existir) e inserir mapa Leaflet
      isEspecie.querySelectorAll("img").forEach(img => {
        const alt = img.alt.toLowerCase();
        if (alt.includes("mapa") || alt.includes("distribuiç") || alt.includes("distribui")) {
          const p = img.closest("p");
          if (p) p.remove(); else img.remove();
        }
      });
      h3Dist.insertAdjacentElement("afterend", mapaContainer);
      if (window.mapaEspecie) setTimeout(() => window.mapaEspecie.invalidateSize(), 50);
    } else {
      // Sem mapa dinâmico: mover imagem estática
      isEspecie.querySelectorAll("img").forEach(img => {
        const alt = img.alt.toLowerCase();
        if (alt.includes("mapa") || alt.includes("distribuiç") || alt.includes("distribui")) {
          const el = (img.parentElement.tagName === "PICTURE") ? img.parentElement : img;
          const pMapa = el.closest("p");
          h3Dist.insertAdjacentElement("afterend", el);
          if (pMapa && !pMapa.textContent.trim()) pMapa.remove();
        }
      });
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
