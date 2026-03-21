#!/usr/bin/env python3
"""
Marca o campo 'origem' (e 'licenca') em observacoes.json:
  - registos presentes no CSV do iNaturalist → origem: "inaturalist", licenca: <do CSV>
  - restantes                                → origem: "grupo icarus"

Matching por (data, nome_cientifico, observador) onde observador é
comparado contra user_login E user_name do CSV (a migração usou ambos).
Idempotente: sobrescreve 'origem'/'licenca' em todos os registos.
"""

import csv
import json
from collections import defaultdict
from pathlib import Path

BASE   = Path(__file__).resolve().parents[1] / 'src' / '_data'
CSV_IN = BASE / 'observations-695800.csv'
OBS_IN = BASE / 'observacoes.json'

# ── 1. Construir índice do CSV ────────────────────────────────────────────────
# chave: (data, nome_cientifico, observador_alias) → lista de licenças
# cada linha do CSV gera duas entradas: uma para user_login e outra para user_name
csv_index: dict[tuple, list[str]] = defaultdict(list)

with CSV_IN.open(encoding='utf-8') as f:
    for row in csv.DictReader(f):
        data    = (row.get('observed_on') or '')[:10].strip()
        nome    = (row.get('scientific_name') or '').strip()
        login   = (row.get('user_login') or '').strip()
        name    = (row.get('user_name') or '').strip()
        licenca = (row.get('license') or '').strip()

        if not (data and nome):
            continue
        if login:
            csv_index[(data, nome, login)].append(licenca)
        if name and name != login:
            csv_index[(data, nome, name)].append(licenca)

print(f'CSV: {len(csv_index)} chaves únicas indexadas')

# ── 2. Consumo sequencial para evitar over-match ─────────────────────────────
# pointer de posição por chave
pos: dict[tuple, int] = defaultdict(int)

def buscar_licenca(data: str, nome: str, obs: str) -> str | None:
    """Retorna a licença se houver match, ou None."""
    chave = (data, nome, obs)
    lista = csv_index.get(chave)
    if not lista:
        return None
    idx = pos[chave]
    if idx >= len(lista):
        return None          # mais registos no JSON do que no CSV com esta chave
    pos[chave] = idx + 1
    return lista[idx]

# ── 3. Marcar cada registo do JSON ────────────────────────────────────────────
with OBS_IN.open(encoding='utf-8') as f:
    dados = json.load(f)

n_inat  = 0
n_grupo = 0

for o in dados:
    nome = (o.get('nome_cientifico') or '').strip()
    data = (o.get('data') or '')[:10].strip()
    obs  = (o.get('observador') or '').strip()

    licenca = buscar_licenca(data, nome, obs)

    if licenca is not None:
        o['origem']  = 'inaturalist'
        o['licenca'] = licenca
        n_inat += 1
    else:
        o['origem'] = 'grupo icarus'
        o.pop('licenca', None)   # remover se tinha ficado do run anterior
        n_grupo += 1

# ── 4. Gravar ────────────────────────────────────────────────────────────────
with OBS_IN.open('w', encoding='utf-8') as f:
    json.dump(dados, f, ensure_ascii=False, indent=2)

print(f'Marcados como iNaturalist : {n_inat}')
print(f'Marcados como Grupo icarus: {n_grupo}')
print(f'Total                     : {n_inat + n_grupo}')
