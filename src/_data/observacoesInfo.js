const { execSync } = require('child_process');
const path = require('path');

module.exports = function () {
  try {
    // Data do último commit que tocou neste ficheiro — imune a rebuilds/deploys
    const out = execSync(
      'git log -1 --format="%aI" -- src/_data/observacoes.json',
      { cwd: path.join(__dirname, '..', '..') }
    ).toString().trim();
    return { ultimaAtualizacao: out ? new Date(out) : null };
  } catch (e) {
    return { ultimaAtualizacao: null };
  }
};
