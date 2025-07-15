#!/bin/bash

# Caminho para a pasta onde está o site convertido
PASTA_SITE="${1:-.}"

echo "A corrigir paths absolutos dentro da pasta: $PASTA_SITE"

# Encontra todos os ficheiros de texto (HTML, CSS, JS, etc.) e substitui "/wp-content" por "wp-content"
find "$PASTA_SITE" -type f \( -name "*.html" -o -name "*.css" -o -name "*.js" -o -name "*.xml" \) -print0 |
  while IFS= read -r -d '' ficheiro; do
    echo "Corrigindo: $ficheiro"
    sed -i 's|"/wp-content|"wp-content|g' "$ficheiro"
  done

echo "✅ Substituições concluídas."
