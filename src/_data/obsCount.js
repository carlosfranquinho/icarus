const obs = require('./observacoes.json');
const counts = {};
obs.forEach(function (o) {
  if (o.nome_cientifico) {
    counts[o.nome_cientifico] = (counts[o.nome_cientifico] || 0) + 1;
  }
});
module.exports = counts;
