// Converte os KML dos concelhos para um único GeoJSON
// Uso: node ferramentas/kml-to-geojson.js

const fs = require("fs");
const path = require("path");
const { DOMParser } = require("@xmldom/xmldom");
const togeojson = require("@tmcw/togeojson");

const PLACES = path.join(__dirname, "../src/assets/places");
const OUTPUT = path.join(PLACES, "concelhos.geojson");

const ficheiros = [
  "Marinha Grande.kml",
  "Leiria.kml",
  "Batalha.kml",
  "Porto de Mós.kml",
];

const features = [];

ficheiros.forEach((f) => {
  const kml = fs.readFileSync(path.join(PLACES, f), "utf-8");
  const doc = new DOMParser().parseFromString(kml, "text/xml");
  const geojson = togeojson.kml(doc);
  const nome = path.basename(f, ".kml");
  geojson.features.forEach((feat) => {
    feat.properties = { nome };
    features.push(feat);
  });
});

const colecao = { type: "FeatureCollection", features };
fs.writeFileSync(OUTPUT, JSON.stringify(colecao));
console.log(`Gerado: ${OUTPUT} (${features.length} features)`);
