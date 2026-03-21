'use strict';
// Anos para os quais são geradas páginas de "primeiras observações"
module.exports = Array.from({ length: 2026 - 2012 + 1 }, (_, i) => 2012 + i);
// [2012, 2013, ..., 2026]
