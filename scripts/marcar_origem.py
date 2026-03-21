#!/usr/bin/env python3
"""
Marca o campo 'origem' (e 'licenca') em observacoes.json:
  - registos presentes no CSV do iNaturalist → origem: "inaturalist", licenca: "CC BY-NC"
  - restantes                                → origem: "grupo icarus"

Matching por (data, nome_cientifico, observador).
"""

import csv
import json
import sys
from collections import Counter
from pathlib import Path

BASE   = Path(__file__).resolve().parents[1] / 'src' / '_data'
CSV_IN = BASE / 'observations-531454.csv'
OBS_IN = BASE / 'observacoes.json'

LICENCA_INATURALIST = 'CC BY-NC'

# ── 1. Construir multiset de chaves do CSV ────────────────────────────────────
csv_keys: Counter = Counter()

with CSV_IN.open(encoding='utf-8') as f:
    reader = csv.DictReader(f)
    for row in reader:
        nome = (row.get('scientificName') or '').strip()
        data = (row.get('observationDate') or '')[:10].strip()
        obs  = (row.get('recordedBy') or '').strip()
        if nome and data:
            csv_keys[(data, nome, obs)] += 1

total_csv = sum(csv_keys.values())
print(f'CSV: {total_csv} registos lidos')

# ── 2. Marcar cada registo do JSON ────────────────────────────────────────────
with OBS_IN.open(encoding='utf-8') as f:
    dados = json.load(f)

remaining = Counter(csv_keys)  # cópia para consumo um-a-um
n_inat  = 0
n_grupo = 0
n_skip  = 0  # já tinha 'origem'

for o in dados:
    if 'origem' in o:
        n_skip += 1
        continue

    nome = (o.get('nome_cientifico') or '').strip()
    data = (o.get('data') or '')[:10].strip()
    obs  = (o.get('observador') or '').strip()
    chave = (data, nome, obs)

    if remaining[chave] > 0:
        remaining[chave] -= 1
        o['origem']  = 'inaturalist'
        o['licenca'] = LICENCA_INATURALIST
        n_inat += 1
    else:
        o['origem'] = 'grupo icarus'
        n_grupo += 1

# ── 3. Gravar ────────────────────────────────────────────────────────────────
with OBS_IN.open('w', encoding='utf-8') as f:
    json.dump(dados, f, ensure_ascii=False, indent=2)

print(f'Marcados como iNaturalist : {n_inat}')
print(f'Marcados como Grupo icarus: {n_grupo}')
if n_skip:
    print(f'Já tinham origem (ignorados): {n_skip}')

# Chaves do CSV sem match no JSON (informativo)
nao_encontradas = sum(v for v in remaining.values() if v > 0)
if nao_encontradas:
    print(f'\nAviso: {nao_encontradas} registo(s) do CSV sem match no JSON '
          f'(podem ter sido filtrados na migração)')
