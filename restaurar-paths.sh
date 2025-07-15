#!/bin/bash

PASTA_SITE="${1:-.}"

echo "A restaurar paths relativos para absolutos na pasta: $PASTA_SITE"

find "$PASTA_SITE" -type f \( -name "*.html" -o -name "*.css" -o -name "*.js" -o -name "*.xml" \) -print0 |
  while IFS= read -r -d '' ficheiro; do
    echo "A corrigir: $ficheiro"
    # Só adiciona / se não estiver já presente
    sed -i 's|\([^/]\)wp-content|\1/wp-content|g' "$ficheiro"
    sed -i 's|\([^/]\)wp-includes|\1/wp-includes|g' "$ficheiro"
  done

echo "✅ Substituições concluídas."
