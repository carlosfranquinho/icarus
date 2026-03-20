const fs = require('fs');
const path = require('path');

module.exports = function () {
  const filePath = path.join(__dirname, 'observacoes.json');
  try {
    const stat = fs.statSync(filePath);
    return { ultimaAtualizacao: stat.mtime };
  } catch (e) {
    return { ultimaAtualizacao: null };
  }
};
