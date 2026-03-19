// Theme toggle
const temaToggle = document.getElementById('tema-toggle');
if (temaToggle) {
  temaToggle.addEventListener('click', () => {
    const html = document.documentElement;
    const current = html.getAttribute('data-theme');
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = current === 'dark' || (!current && systemDark);
    const next = isDark ? 'light' : 'dark';
    html.setAttribute('data-theme', next);
    localStorage.setItem('icarus-tema', next);
  });
}

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

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && lista.classList.contains('aberta')) {
      lista.classList.remove('aberta');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.focus();
    }
  });
}

// Sticky nav transparency toggle for homepage (with rAF throttle)
const nav = document.querySelector('.nav-principal');
if (nav && document.body.classList.contains('is-home')) {
  let rafPending = false;
  window.addEventListener('scroll', () => {
    if (!rafPending) {
      rafPending = true;
      requestAnimationFrame(() => {
        nav.classList.toggle('scrolled', window.scrollY > 50);
        rafPending = false;
      });
    }
  }, { passive: true });
}

// Rotacao aleatoria das silhuetas nos cards de familia
document.querySelectorAll('.card-familia-ficha-img img').forEach(img => {
  const deg = (Math.random() * 20 - 10).toFixed(1);
  img.style.transform = `rotate(${deg}deg)`;
});

// Legendas nas fotos dos posts: tratadas em build time (.eleventy.js addTransform)

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

  // Figuras das espécies: tratadas em build time (.eleventy.js addTransform)

  // Paginação da tabela de observações (20 por página)
  const tbody = document.getElementById('obs-tbody');
  const paginacao = document.getElementById('obs-paginacao');
  if (tbody && paginacao) {
    const linhas = Array.from(tbody.querySelectorAll('tr'));
    const POR_PAG = 20;
    if (linhas.length > POR_PAG) {
      let pagina = 0;
      const total = Math.ceil(linhas.length / POR_PAG);
      const info = document.getElementById('obs-info');
      const btnAnt = document.getElementById('obs-ant');
      const btnSeg = document.getElementById('obs-seg');

      function mostrar(p) {
        linhas.forEach((tr, i) => {
          tr.style.display = (i >= p * POR_PAG && i < (p + 1) * POR_PAG) ? '' : 'none';
        });
        const de = p * POR_PAG + 1;
        const ate = Math.min((p + 1) * POR_PAG, linhas.length);
        info.textContent = `${de}–${ate} de ${linhas.length}`;
        btnAnt.disabled = p === 0;
        btnSeg.disabled = p === total - 1;
      }

      btnAnt.addEventListener('click', () => { pagina--; mostrar(pagina); });
      btnSeg.addEventListener('click', () => { pagina++; mostrar(pagina); });
      paginacao.style.display = 'flex';
      mostrar(0);
    }
  }

});
