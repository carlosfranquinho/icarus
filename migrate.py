#!/usr/bin/env python3
"""
Migração HTML WP → Markdown 11ty para o Grupo icarus.
Uso: python3 migrate.py [--dry-run]
"""

import os
import re
import sys
import json
import shutil
from pathlib import Path
from datetime import datetime, timezone
from bs4 import BeautifulSoup, Tag
import markdownify

ROOT = Path("/dados/projetos/icarus")
SRC = ROOT / "src"
IMAGENS_DEST = ROOT / "imagens"
DRY = "--dry-run" in sys.argv

# ── helpers ────────────────────────────────────────────────────────────────

def limpar_path_imagem(src_attr: str) -> str:
    """Converte /wp-content/uploads/YYYY/MM/img.jpg → /imagens/YYYY/MM/img.jpg"""
    if not src_attr:
        return src_attr
    # strip WP resize suffixes before extension
    src_attr = re.sub(r"-\d+x\d+(\.\w+)$", r"\1", src_attr)
    return src_attr.replace("/wp-content/uploads/", "/imagens/")

def extrair_meta(soup: BeautifulSoup, name: str = None, prop: str = None) -> str:
    if name:
        tag = soup.find("meta", attrs={"name": name})
    elif prop:
        tag = soup.find("meta", attrs={"property": prop})
    else:
        return ""
    return tag["content"].strip() if tag and tag.get("content") else ""

def resolver_imagem(img_tag) -> str:
    """Extrai o URL original de uma img WP (lazyload ou normal)."""
    # Prefer data-full-url (original, unresized)
    src = img_tag.get("data-full-url", "")
    if not src:
        # Try data-srcset: take the largest width entry
        ds = img_tag.get("data-srcset", "") or img_tag.get("srcset", "")
        if ds:
            entries = [e.strip().split() for e in ds.split(",") if e.strip()]
            # Sort by width descriptor (e.g. "1920w"), pick largest
            originals = [(int(e[1].rstrip("w")), e[0]) for e in entries if len(e) == 2 and e[1].endswith("w")]
            if originals:
                src = sorted(originals)[-1][1]
    if not src:
        # Fallback to data-src
        src = img_tag.get("data-src", "")
    if not src:
        src = img_tag.get("src", "")
    # Skip base64 placeholders
    if src.startswith("data:"):
        src = ""
    # Fix WP upload path
    src = src.replace("/wp-content/uploads/", "/imagens/")
    # Strip resize suffix
    src = re.sub(r"-\d+x\d+(\.\w+)$", r"\1", src)
    return src


def html_para_markdown(html_str: str) -> str:
    """Converte HTML → Markdown com limpeza de artefactos WP."""
    # Strip known WP block wrappers that add no content
    soup = BeautifulSoup(html_str, "html.parser")

    # Fix all images: resolve lazy-load src first
    for img in soup.find_all("img"):
        src = resolver_imagem(img)
        alt = img.get("alt", "")
        # Replace img with clean version
        new_img = soup.new_tag("img", src=src, alt=alt, loading="lazy")
        img.replace_with(new_img)

    # Remove overlay divs
    for el in soup.select(".wp-block-themeisle-blocks-advanced-columns-overlay"):
        el.decompose()

    # Remove WP font-awesome icon wrappers (keep only text content after them)
    for el in soup.select(".wp-block-themeisle-blocks-font-awesome-icons"):
        el.decompose()

    # Remove comment forms, navigation, etc.
    for sel in ["#respond", ".comment-respond", ".comments-area",
                ".wp-block-post-comments", ".navigation", ".post-navigation"]:
        for el in soup.select(sel):
            el.decompose()

    # Flatten innerblocks-wrap divs (just keep their content)
    for el in soup.select(".innerblocks-wrap, .wp-block-themeisle-blocks-advanced-column, .wp-block-themeisle-blocks-advanced-columns"):
        el.unwrap()

    # Unwrap wp-block-columns
    for el in soup.select(".wp-block-columns, .wp-block-column"):
        el.unwrap()

    # Convert gallery figures to regular img list (imgs already resolved above)
    for gallery in soup.select(".wp-block-gallery"):
        imgs = gallery.find_all("img")
        new_content = ""
        for img in imgs:
            src = img.get("src", "")
            alt = img.get("alt", "")
            new_content += f'<img src="{src}" alt="{alt}" loading="lazy">\n'
        gallery.replace_with(BeautifulSoup(new_content, "html.parser"))

    # Remove wp-block-separator (horizontal rules are fine, just clean class)
    for el in soup.select("hr"):
        el.attrs = {}

    cleaned_html = str(soup)

    md = markdownify.markdownify(
        cleaned_html,
        heading_style=markdownify.ATX,
        bullets="-",
        strip=["script", "style", "form", "input", "button"],
    )

    # Clean up excessive blank lines
    md = re.sub(r"\n{4,}", "\n\n\n", md)
    # Remove empty links (but NOT empty-alt images: use negative lookbehind for !)
    md = re.sub(r"(?<!!)(\[\]\([^)]*\))", "", md)
    # Remove leftover HTML comments
    md = re.sub(r"<!--.*?-->", "", md, flags=re.DOTALL)
    # Clean up WP class noise that leaks into md
    md = re.sub(r'\{[^}]*\}', "", md)
    md = md.strip()
    return md

def yaml_str(value: str) -> str:
    """Wrap string in YAML quotes if needed."""
    if not value:
        return '""'
    # Use double-quotes, escape internal double-quotes
    escaped = value.replace('"', '\\"')
    return f'"{escaped}"'

def escrever(path: Path, conteudo: str, descricao: str = ""):
    if DRY:
        print(f"  [DRY] → {path.relative_to(ROOT)} ({descricao})")
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(conteudo, encoding="utf-8")
    print(f"  ✓ {path.relative_to(ROOT)}")

# ── POSTS ──────────────────────────────────────────────────────────────────

def migrar_post(html_path: Path):
    """Migra um post de actividade para Markdown."""
    parts = html_path.parts
    # Expects …/YYYY/MM/DD/slug/index.html
    try:
        idx = next(i for i, p in enumerate(parts) if re.match(r"^\d{4}$", p))
        ano, mes, dia, slug = parts[idx], parts[idx+1], parts[idx+2], parts[idx+3]
    except (StopIteration, IndexError):
        print(f"  ! Skipping (bad path): {html_path}")
        return

    soup = BeautifulSoup(html_path.read_text(encoding="utf-8"), "html.parser")

    # --- Metadados ---
    title = extrair_meta(soup, prop="og:title") or soup.title.string or slug
    title = re.sub(r"\s*[–—-]\s*Grupo icarus\s*$", "", title).strip()

    descricao = extrair_meta(soup, name="description") or extrair_meta(soup, prop="og:description")

    pub_time = extrair_meta(soup, prop="article:published_time")
    if pub_time:
        try:
            date = datetime.fromisoformat(pub_time.replace("Z", "+00:00")).strftime("%Y-%m-%d")
        except ValueError:
            date = f"{ano}-{mes}-{dia}"
    else:
        date = f"{ano}-{mes}-{dia}"

    imagem_og = extrair_meta(soup, prop="og:image")
    imagem = limpar_path_imagem(imagem_og) if imagem_og else ""

    # Tags from JSON-LD
    tags = []
    tags_meta = soup.find("meta", attrs={"property": "article:tag"})
    if tags_meta:
        tags = [t.strip() for t in tags_meta.get("content", "").split(",") if t.strip()]

    # Categoria from articleSection in JSON-LD
    categoria = ""
    ld_script = soup.find("script", attrs={"type": "application/ld+json"})
    if ld_script:
        try:
            ld = json.loads(ld_script.string)
            graph = ld.get("@graph", [ld])
            for node in graph:
                if node.get("@type") == "Article":
                    sections = node.get("articleSection", [])
                    if sections:
                        categoria = sections[0].lower()
                    break
        except (json.JSONDecodeError, AttributeError):
            pass

    if not categoria:
        # Guess from slug
        if "noturnas" in slug or "noturnas" in str(html_path):
            categoria = "noturnas"
        elif "diurnas" in slug:
            categoria = "diurnas"

    # Local: scan for map-marker adjacent text
    local = ""
    content_div = soup.find("div", class_=re.compile(r"entry-content|post-content"))
    if content_div:
        # Look for the paragraph after the map-marker icon
        for p in content_div.find_all("p"):
            text = p.get_text().strip()
            # Heuristic: location typically has commas, is short, no digits
            if "," in text and len(text) < 120 and not re.search(r"\d{4}", text):
                prev = p.find_previous_sibling("p")
                if prev and prev.find("i", class_=re.compile("fa-map-marker")):
                    local = text
                    break

    # --- Conteúdo ---
    content_div = soup.find("div", class_=re.compile(r"entry-content|post-content|single-post-wrap"))
    if not content_div:
        # Try article
        article = soup.find("article")
        content_div = article

    if content_div:
        # Remove sidebar-like first column (date/location/participants box)
        # It's typically the first advanced-column with font-awesome icons
        first_col = content_div.find("div", class_="wp-block-themeisle-blocks-advanced-column")
        if first_col and first_col.find("i", class_=re.compile("fa-calendar")):
            first_col.decompose()

        md_body = html_para_markdown(str(content_div))
    else:
        md_body = ""

    # --- Frontmatter ---
    tags_yaml = json.dumps(tags, ensure_ascii=False) if tags else "[]"
    permalink = f"/{ano}/{mes}/{dia}/{slug}/"

    fm_parts = [
        f"layout: layouts/post.njk",
        f"title: {yaml_str(title)}",
        f"date: {date}",
    ]
    if descricao:
        fm_parts.append(f"descricao: {yaml_str(descricao)}")
    if categoria:
        fm_parts.append(f"categoria: {categoria}")
    if local:
        fm_parts.append(f"local: {yaml_str(local)}")
    if imagem:
        fm_parts.append(f"imagem: {imagem}")
    if tags:
        fm_parts.append(f"tags: {tags_yaml}")
    fm_parts.append(f"permalink: {permalink}")

    frontmatter = "---\n" + "\n".join(fm_parts) + "\n---\n\n"
    conteudo = frontmatter + md_body

    dest = SRC / "posts" / ano / f"{slug}.md"
    escrever(dest, conteudo, f"post {date}")

# ── ESPÉCIES ───────────────────────────────────────────────────────────────

def migrar_especie(html_path: Path, grupo: str):
    """Migra uma ficha de espécie para Markdown."""
    parts = html_path.parts
    # …/borboletas-diurnas/FAMILIA/ESPECIE/index.html
    especie_slug = parts[-2]
    familia_slug = parts[-3]

    if familia_slug in ("borboletas-diurnas", "borboletas-noturnas"):
        # This is a family index page, not a species
        return None

    soup = BeautifulSoup(html_path.read_text(encoding="utf-8"), "html.parser")

    title = extrair_meta(soup, prop="og:title") or soup.title.string or especie_slug
    # Title often: "Nome cientifico - borboleta - Familia - Grupo icarus"
    title_parts = [p.strip() for p in title.split(" - ")]
    nome_cientifico = title_parts[0] if title_parts else especie_slug.replace("-", " ").title()

    descricao = extrair_meta(soup, name="description") or extrair_meta(soup, prop="og:description")

    imagem_og = extrair_meta(soup, prop="og:image")
    imagem = limpar_path_imagem(imagem_og) if imagem_og else ""

    # Familia from content
    familia = familia_slug.title()
    subfamilia = ""
    nome_comum = ""

    content_div = soup.find("article") or soup.find("div", class_=re.compile(r"page-content-wrap|entry-content"))
    if content_div:
        # Try to extract familia from <a href="/borboletas-.../FAMILIA/">
        for a in content_div.find_all("a", href=True):
            href = a["href"]
            if re.search(r"/borboletas-(diurnas|noturnas)/([^/]+)/$", href):
                m = re.search(r"/borboletas-(?:diurnas|noturnas)/([^/]+)/$", href)
                if m:
                    familia = m.group(1).title()

        # Look for subfamily
        for p in content_div.find_all("p"):
            text = p.get_text()
            if "Subfamília:" in text or "Subfamilia:" in text:
                m = re.search(r"Subfam[ií]lia:\s*(\S+)", text)
                if m:
                    subfamilia = m.group(1)

        md_body = html_para_markdown(str(content_div))
    else:
        md_body = ""

    # Remove the h2 heading with scientific name if it's the first thing
    md_body = re.sub(r"^##\s+" + re.escape(nome_cientifico) + r"[^\n]*\n", "", md_body)
    md_body = md_body.strip()

    permalink = f"/borboletas-{grupo}/{familia_slug}/{especie_slug}/"

    fm_parts = [
        f"layout: layouts/especie.njk",
        f"tipo: especie",
        f"nome_cientifico: {yaml_str(nome_cientifico)}",
    ]
    if nome_comum:
        fm_parts.append(f"nome_comum: {yaml_str(nome_comum)}")
    fm_parts.append(f"familia: {familia}")
    if subfamilia:
        fm_parts.append(f"subfamilia: {subfamilia}")
    fm_parts.append(f"grupo: {grupo}")
    if imagem:
        fm_parts.append(f"imagem: {imagem}")
    if descricao:
        fm_parts.append(f"descricao: {yaml_str(descricao)}")
    fm_parts.append(f"permalink: {permalink}")

    frontmatter = "---\n" + "\n".join(fm_parts) + "\n---\n\n"
    conteudo = frontmatter + md_body

    dest = SRC / "especies" / grupo / familia_slug / f"{especie_slug}.md"
    escrever(dest, conteudo, f"especie {nome_cientifico}")
    return familia, familia_slug, grupo

def migrar_familia_index(familia_slug: str, grupo: str, familia_nome: str, descricao: str = ""):
    """Cria index de família."""
    if grupo == "diurnas":
        prefix_url = f"/borboletas-diurnas/{familia_slug}/"
        prefix_path = "diurnas"
    else:
        prefix_url = f"/borboletas-noturnas/{familia_slug}/"
        prefix_path = "noturnas"

    fm = f"""---
layout: layouts/familia.njk
tipo: familia
title: {yaml_str(familia_nome)}
grupo: {grupo}
descricao: {yaml_str(descricao)}
permalink: {prefix_url}
---
"""
    dest = SRC / "especies" / prefix_path / familia_slug / f"{familia_slug}.md"
    escrever(dest, fm, f"familia {familia_nome}")

# ── IMAGENS ────────────────────────────────────────────────────────────────

def copiar_imagens():
    """Copia imagens originais (sem variantes WP) de wp-content/uploads/ → imagens/."""
    uploads = ROOT / "wp-content" / "uploads"
    if not uploads.exists():
        print("  ! wp-content/uploads não encontrado")
        return

    resize_re = re.compile(r"-\d+x\d+\.\w+$")
    copied = 0
    skipped = 0

    for img in uploads.rglob("*"):
        if not img.is_file():
            continue
        if img.suffix.lower() not in (".jpg", ".jpeg", ".png", ".gif", ".svg", ".webp"):
            continue
        if resize_re.search(img.name):
            skipped += 1
            continue

        # Preserve relative path from uploads/
        rel = img.relative_to(uploads)
        dest = IMAGENS_DEST / rel

        if DRY:
            print(f"  [DRY] cp {rel}")
            copied += 1
            continue

        dest.parent.mkdir(parents=True, exist_ok=True)
        if not dest.exists():
            shutil.copy2(img, dest)
            copied += 1

    print(f"  ✓ {copied} imagens copiadas, {skipped} variantes WP ignoradas")

def copiar_logos():
    """Copia logos para imagens/logo/."""
    for nome in ["icarus_logo1.png", "icarus_logo2.png", "icarus_logo3.png"]:
        src = ROOT / "wp-content" / "uploads" / "2020" / "07" / nome
        dest = IMAGENS_DEST / "logo" / nome
        if src.exists():
            if not DRY:
                dest.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(src, dest)
            print(f"  ✓ logo: {nome}")

# ── MAIN ───────────────────────────────────────────────────────────────────

def main():
    print(f"{'[DRY RUN] ' if DRY else ''}Migração Grupo icarus → 11ty\n")

    # 1. Posts
    print("=== Posts ===")
    posts = sorted(ROOT.glob("[0-9][0-9][0-9][0-9]/[0-9][0-9]/[0-9][0-9]/*/index.html"))
    for p in posts:
        migrar_post(p)
    print(f"\n  Total: {len(posts)} posts\n")

    # 2. Espécies diurnas
    print("=== Espécies diurnas ===")
    familias_diurnas = set()
    for p in sorted(ROOT.glob("borboletas-diurnas/*/*/index.html")):
        result = migrar_especie(p, "diurnas")
        if result:
            familia, familia_slug, _ = result
            familias_diurnas.add((familia, familia_slug))

    # Family index pages
    for familia, familia_slug in sorted(familias_diurnas):
        # Get description from the family index HTML if available
        familia_html = ROOT / "borboletas-diurnas" / familia_slug / "index.html"
        desc = ""
        if familia_html.exists():
            soup = BeautifulSoup(familia_html.read_text(encoding="utf-8"), "html.parser")
            desc = extrair_meta(soup, name="description") or ""
        migrar_familia_index(familia_slug, "diurnas", familia, desc)

    print(f"\n  Total: {len(list(ROOT.glob('borboletas-diurnas/*/*/index.html')))} espécies\n")

    # 3. Espécies noturnas
    print("=== Espécies noturnas ===")
    familias_noturnas = set()
    for p in sorted(ROOT.glob("borboletas-noturnas/*/*/index.html")):
        result = migrar_especie(p, "noturnas")
        if result:
            familia, familia_slug, _ = result
            familias_noturnas.add((familia, familia_slug))

    for familia, familia_slug in sorted(familias_noturnas):
        familia_html = ROOT / "borboletas-noturnas" / familia_slug / "index.html"
        desc = ""
        if familia_html.exists():
            soup = BeautifulSoup(familia_html.read_text(encoding="utf-8"), "html.parser")
            desc = extrair_meta(soup, name="description") or ""
        migrar_familia_index(familia_slug, "noturnas", familia, desc)

    print(f"\n  Total: {len(list(ROOT.glob('borboletas-noturnas/*/*/index.html')))} espécies\n")

    # 4. Imagens
    print("=== Imagens ===")
    copiar_imagens()
    copiar_logos()

    print("\n✅ Migração concluída!")
    if DRY:
        print("   (dry run — nenhum ficheiro escrito)")

if __name__ == "__main__":
    main()
