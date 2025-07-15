#!/bin/bash

PASTA_SITE="${1:-.}"

echo "A corrigir paths absolutos dentro da pasta: $PASTA_SITE"

find "$PASTA_SITE" -type f \( -name "*.html" -o -name "*.css" -o -name "*.js" -o -name "*.xml" \) -print0 |
  while IFS= read -r -d '' ficheiro; do
    echo "Corrigindo: $ficheiro"
    # Corrigir /wp-content → wp-content
    sed -i 's|/wp-content|wp-content|g' "$ficheiro"
    # Corrigir /wp-includes → wp-includes
    sed -i 's|/wp-includes|wp-includes|g' "$ficheiro"
    # Corrigir /wp-json → wp-json
    sed -i 's|/wp-json|wp-json|g' "$ficheiro"
  done

echo "✅ Substituições concluídas."
