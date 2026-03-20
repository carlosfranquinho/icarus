'use strict';

// Licenças que permitem uso dos dados (lowercase)
const LICENCAS_OK = new Set(['cc0', 'cc-by', 'cc-by-sa', 'cc-by-nc', 'cc-by-nc-sa']);

// ── WGS84 → UTM Zone 29N ─────────────────────────────────────────────────────
function latlonParaUtm29n(lat, lon) {
  const a  = 6378137.0, e2 = 0.00669437999014, k0 = 0.9996;
  const lon0 = -9 * Math.PI / 180;
  const latR = lat * Math.PI / 180;
  const lonR = lon * Math.PI / 180;

  const N  = a / Math.sqrt(1 - e2 * Math.sin(latR) ** 2);
  const T  = Math.tan(latR) ** 2;
  const C  = e2 / (1 - e2) * Math.cos(latR) ** 2;
  const A  = Math.cos(latR) * (lonR - lon0);
  const M  = a * (
    (1 - e2/4 - 3*e2**2/64 - 5*e2**3/256) * latR
    - (3*e2/8 + 3*e2**2/32 + 45*e2**3/1024) * Math.sin(2*latR)
    + (15*e2**2/256 + 45*e2**3/1024) * Math.sin(4*latR)
    - (35*e2**3/3072) * Math.sin(6*latR)
  );
  const E = k0 * N * (
    A + (1 - T + C) * A**3/6
    + (5 - 18*T + T**2 + 72*C - 58*e2/(1-e2)) * A**5/120
  ) + 500000;
  const Nn = k0 * (
    M + N * Math.tan(latR) * (
      A**2/2
      + (5 - T + 9*C + 4*C**2) * A**4/24
      + (61 - 58*T + T**2 + 600*C - 330*e2/(1-e2)) * A**6/720
    )
  );
  return { E, N: Nn };
}

function latlonParaUtm1k(lat, lon) {
  const { E, N } = latlonParaUtm29n(lat, lon);
  const N_CYCLE = 4000000;
  const COLUNAS = ['J','K','L','M','N','P','Q','R'];
  const LINHAS  = ['A','B','C','D','E','F','G','H','J','K','L','M','N','P','Q','R','S','T','U','V'];

  const colIdx = Math.floor(E / 100000) - 1;
  const N_rel  = N - N_CYCLE;
  if (colIdx < 0 || colIdx >= 8 || N_rel < 0) return null;
  const rowIdx = Math.floor(N_rel / 100000);
  if (rowIdx >= 20) return null;

  const sqE = Math.floor((E  % 100000) / 1000);
  const sqN = Math.floor((N_rel % 100000) / 1000);

  return `${COLUNAS[colIdx]}${LINHAS[rowIdx]}${String(sqE).padStart(2,'0')}${String(sqN).padStart(2,'0')}`;
}

// ── Ponto dentro de polígono (ray-casting) ────────────────────────────────────
function pontoNoPoligono(lat, lon, coords) {
  // coords = array de anéis; primeiro anel é o exterior
  const anel = coords[0];
  let dentro = false;
  for (let i = 0, j = anel.length - 1; i < anel.length; j = i++) {
    const [xi, yi] = anel[i]; // [lon, lat]
    const [xj, yj] = anel[j];
    const intersect = ((yi > lat) !== (yj > lat))
      && (lon < (xj - xi) * (lat - yi) / (yj - yi) + xi);
    if (intersect) dentro = !dentro;
  }
  return dentro;
}

function pontoNosConcelhos(lat, lon, features) {
  for (const feat of features) {
    const geom = feat.geometry;
    if (geom.type === 'Polygon') {
      if (pontoNoPoligono(lat, lon, geom.coordinates)) return feat.properties.nome;
    } else if (geom.type === 'MultiPolygon') {
      for (const poly of geom.coordinates) {
        if (pontoNoPoligono(lat, lon, poly)) return feat.properties.nome;
      }
    }
  }
  return null;
}

module.exports = { LICENCAS_OK, latlonParaUtm29n, latlonParaUtm1k, pontoNoPoligono, pontoNosConcelhos };
