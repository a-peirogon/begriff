import argparse
import http.server
import json
import re
import shutil
import sys
import threading
import time
import logging
from pathlib import Path

import frontmatter
import markdown as md_lib
from jinja2 import Environment, FileSystemLoader, select_autoescape

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-7s  %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("begriff")

BASE_DIR      = Path(__file__).parent
VAULT_DIR     = BASE_DIR / "vault"
TEMPLATES_DIR = BASE_DIR / "templates"
STATIC_DIR    = BASE_DIR / "static"
PUBLIC_DIR    = BASE_DIR / "public"

_META_SKIP_KEYS = {"tags", "title", "icon", "layout", "pdf", "video"}

_EMOJI_FALLBACK = "📁"

_EMOJI_KEYWORDS: list[tuple[str, str]] = [
    ("filosof",      "🧠"),
    ("lógic",        "🔢"),
    ("logic",        "🔢"),
    ("étic",         "⚖️"),
    ("etic",         "⚖️"),
    ("estétic",      "🎨"),
    ("estetic",      "🎨"),
    ("epistemo",     "🔍"),
    ("metafísic",    "🌌"),
    ("metafisic",    "🌌"),
    ("polític",      "🏛️"),
    ("politic",      "🏛️"),
    ("cienci",       "🔬"),
    ("física",       "⚛️"),
    ("fisica",       "⚛️"),
    ("química",      "🧪"),
    ("quimica",      "🧪"),
    ("biolog",       "🧬"),
    ("matemátic",    "📐"),
    ("matematic",    "📐"),
    ("historia",     "📜"),
    ("literatur",    "📚"),
    ("lingüístic",   "🗣️"),
    ("linguistic",   "🗣️"),
    ("lengua",       "🗣️"),
    ("griego",       "🏺"),
    ("latín",        "🏺"),
    ("latin",        "🏺"),
    ("economía",     "💰"),
    ("economia",     "💰"),
    ("psicolog",     "🧩"),
    ("sociolog",     "👥"),
    ("arte",         "🎨"),
    ("música",       "🎵"),
    ("musica",       "🎵"),
    ("religio",      "🕊️"),
    ("teología",     "🕊️"),
    ("teologia",     "🕊️"),
    ("derecho",      "⚖️"),
    ("tecnolog",     "💻"),
    ("computa",      "💻"),
    ("program",      "💻"),
    ("medicin",      "🩺"),
    ("salud",        "🩺"),
    ("geograf",      "🗺️"),
    ("astronom",     "🔭"),
]

def pick_emoji(label: str) -> str:
    low = label.lower()
    for keyword, emoji in _EMOJI_KEYWORDS:
        if keyword in low:
            return emoji
    return _EMOJI_FALLBACK

jinja_env = Environment(
    loader=FileSystemLoader(str(TEMPLATES_DIR)),
    autoescape=select_autoescape(["html"]),
    keep_trailing_newline=True,
)

def render(template_name: str, **ctx) -> str:
    return jinja_env.get_template(template_name).render(**ctx)

_PLACEHOLDER    = "\x00LATEX{{{}}}\x00"
_BLOCK_MATH_RE  = re.compile(r"\$\$(.+?)\$\$",                   re.DOTALL)
_INLINE_MATH_RE = re.compile(r"(?<!\$)\$(?!\$)(.+?)(?<!\$)\$(?!\$)", re.DOTALL)

_CAJA_FENCE_RE = re.compile(
    r"```caja(?P<attrs>[^\n]*)\n(?P<body>.*?)\n```",
    re.DOTALL,
)
_GALERIA_FENCE_RE = re.compile(r"```galeria\n(?P<body>.*?)\n```", re.DOTALL)
_AREAS_FENCE_RE = re.compile(r"```areas\s*```")

_CAJA_COLORS = {
    "dorado":  "#c8b88a",
    "azul":    "#8aaccc",
    "verde":   "#8ac8a0",
    "rojo":    "#c88a8a",
}

_AREAS_PLACEHOLDER = "\x00BEGRIFF_AREAS\x00"

_ATTR_RE = re.compile(r'(\w+)="([^"]*)"')

def _parse_fence_attrs(attrs: str) -> dict:
    return {k: v for k, v in _ATTR_RE.findall(attrs)}

def _render_caja(m: re.Match) -> str:
    attrs = _parse_fence_attrs(m.group("attrs"))
    titulo = attrs.get("título") or attrs.get("titulo") or ""
    color_key = attrs.get("color", "dorado")
    color = _CAJA_COLORS.get(color_key, _CAJA_COLORS["dorado"])
    inner_html = md_lib.markdown(m.group("body"), extensions=["extra", "smarty"])
    titulo_html = f'<div class="portal-box-title">{titulo}</div>' if titulo else ""
    return (
        f'<div class="portal-box" style="--portal-box-color:{color};">'
        f'{titulo_html}'
        f'<div class="portal-box-body">{inner_html}</div>'
        f'</div>'
    )

def _render_galeria(m: re.Match) -> str:
    items = []
    for line in m.group("body").splitlines():
        line = line.strip()
        if not line:
            continue
        if "|" in line:
            src, caption = line.split("|", 1)
        else:
            src, caption = line, ""
        src, caption = src.strip(), caption.strip()
        cap_html = f'<figcaption>{caption}</figcaption>' if caption else ""
        items.append(f'<figure class="wiki-gallery-item"><img src="{src}" alt="{caption}" loading="lazy">{cap_html}</figure>')
    return f'<div class="wiki-gallery">{"".join(items)}</div>'

def render_areas_box(subcategorias: dict, root_slug: str, slug_path: list[str],
                      base_path: str) -> str:
    if not subcategorias:
        return ""
    items = []
    for sub_slug, sub in subcategorias.items():
        url = category_url_static(slug_path + [sub_slug], base_path)
        items.append(f'<li><a href="{url}">{sub.get("label", sub_slug)}</a></li>')
    return (
        '<div class="portal-box" style="--portal-box-color:#c8b88a;">'
        '<div class="portal-box-title">Áreas</div>'
        f'<div class="portal-box-body"><ul class="portal-box-list">{"".join(items)}</ul></div>'
        '</div>'
    )

_PORTAL_BOX_OPEN_RE = re.compile(r'<div class="portal-box"')

def _find_wiki_box_spans(html: str) -> list[tuple[int, int]]:
    spans = []
    for m in _PORTAL_BOX_OPEN_RE.finditer(html):
        start = m.start()
        depth = 1
        pos = m.end()
        while depth > 0:
            next_open  = html.find("<div", pos)
            next_close = html.find("</div>", pos)
            if next_close == -1:
                break
            if next_open != -1 and next_open < next_close:
                depth += 1
                pos = next_open + 4
            else:
                depth -= 1
                pos = next_close + 6
        spans.append((start, pos))
    return spans

def group_wiki_boxes(html: str) -> str:
    spans = _find_wiki_box_spans(html)
    if len(spans) < 2:
        return html

    groups: list[list[tuple[int, int]]] = []
    current = [spans[0]]
    for prev, cur in zip(spans, spans[1:]):
        between = html[prev[1]:cur[0]]
        if between.strip() == "":
            current.append(cur)
        else:
            groups.append(current)
            current = [cur]
    groups.append(current)

    out = html
    for group in reversed(groups):
        if len(group) < 2:
            continue
        start, end = group[0][0], group[-1][1]
        inner = out[start:end]
        wrapped = f'<div class="portal-box-row">{inner}</div>'
        out = out[:start] + wrapped + out[end:]
    return out

def render_markdown(text: str) -> tuple[str, str]:
    stash: list[str] = []

    def _stash(m: re.Match) -> str:
        stash.append(m.group(0))
        return _PLACEHOLDER.format(len(stash) - 1)

    protected = _BLOCK_MATH_RE.sub(_stash, text)
    protected  = _INLINE_MATH_RE.sub(_stash, protected)

    protected = _CAJA_FENCE_RE.sub(lambda m: f"\n\n{_render_caja(m)}\n\n", protected)
    protected = _GALERIA_FENCE_RE.sub(lambda m: f"\n\n{_render_galeria(m)}\n\n", protected)
    protected = _AREAS_FENCE_RE.sub(f"\n\n{_AREAS_PLACEHOLDER}\n\n", protected)

    converter  = md_lib.Markdown(extensions=["extra", "smarty", "toc"])
    html       = converter.convert(protected)
    toc        = converter.toc if len(getattr(converter, "toc_tokens", [])) > 1 else ""

    unescape = lambda s: re.sub(r"\x00LATEX\{(\d+)\}\x00", lambda m: stash[int(m.group(1))], s)
    return unescape(html), unescape(toc)

def _meta_fields(frontmatter_data: dict) -> list[tuple[str, str, object]]:
    fields: list[tuple[str, str, object]] = []
    for key, val in frontmatter_data.items():
        if key in _META_SKIP_KEYS or key.startswith("_"):
            continue
        if val is None or val == "" or isinstance(val, (list, dict)):
            continue
        label = key.replace("_", " ").replace("-", " ").title()
        fields.append((key, label, val))
    return fields

def parse_md(path: Path) -> dict:
    post = frontmatter.load(str(path))
    data = dict(post.metadata)
    data["_meta_fields"] = _meta_fields(data)
    data["body"], data["toc"] = render_markdown(post.content)
    data["_raw"] = post.content

    _date_val = None
    for _key in ("fecha", "date", "creado", "created"):
        if data.get(_key):
            _date_val = data[_key]
            break

    data["_mtime"] = path.stat().st_mtime
    if _date_val is not None:
        try:
            import datetime as _dt
            if isinstance(_date_val, _dt.date) and not isinstance(_date_val, _dt.datetime):
                _date_val = _dt.datetime.combine(_date_val, _dt.time.min)
            if isinstance(_date_val, _dt.datetime):
                data["_mtime"] = _date_val.timestamp()
        except Exception:
            pass

    return data

def load_category_index(dir_path: Path) -> dict | None:
    idx = dir_path / "_index.md"
    if not idx.exists():
        return None
    data = parse_md(idx)
    data["_path"] = str(idx)
    return data

def load_category(dir_path: Path, slug_path: list[str]) -> dict:
    index = load_category_index(dir_path)
    label = (index.get("title") if index else None) \
        or slug_path[-1].replace("_", " ").title()

    icon     = index.get("icon") if index else None
    emoji    = icon or pick_emoji(label)

    conceptos: list[dict] = []
    for md_file in sorted(dir_path.glob("*.md")):
        if md_file.stem == "_index":
            continue
        data = parse_md(md_file)
        data["_slug"]     = md_file.stem
        data["_cat_path"] = list(slug_path)
        data["_path"]     = str(md_file)
        data.setdefault("concept", data.get("title") or md_file.stem.replace("_", " ").title())
        conceptos.append(data)

    subcategorias: dict[str, dict] = {}
    for sub in sorted(dir_path.iterdir()):
        if not sub.is_dir() or sub.name.startswith("_"):
            continue
        subcategorias[sub.name] = load_category(sub, slug_path + [sub.name])

    total = len(conceptos) + sum(s["total_conceptos"] for s in subcategorias.values())

    return {
        "label":           label,
        "index":           index,
        "icon":            icon,
        "emoji":           emoji,
        "conceptos":       conceptos,
        "subcategorias":   subcategorias,
        "_slug_path":      list(slug_path),
        "total_conceptos": total,
    }

def load_tree() -> tuple[dict, dict]:
    if not VAULT_DIR.exists():
        return {}, {}
    tree: dict[str, dict] = {}
    catalogos: dict[str, dict] = {}
    for path in sorted(VAULT_DIR.iterdir()):
        if path.is_dir() and not path.name.startswith("_"):
            node = load_category(path, [path.name])
            es_catalogo = bool(node["index"] and node["index"].get("tipo") == "catalogo")
            node["es_catalogo"] = es_catalogo
            if es_catalogo:
                catalogos[path.name] = node
            else:
                tree[path.name] = node
    return tree, catalogos

def load_uncategorized() -> list[dict]:
    if not VAULT_DIR.exists():
        return []
    entries: list[dict] = []
    for md_file in sorted(VAULT_DIR.glob("*.md")):
        if md_file.stem == "_index":
            continue
        data = parse_md(md_file)
        data["_slug"]     = md_file.stem
        data["_cat_path"] = []
        data["_path"]     = str(md_file)
        data.setdefault("concept", data.get("title") or md_file.stem.replace("_", " ").title())
        entries.append(data)
    return entries

def load_welcome() -> dict | None:
    return load_category_index(VAULT_DIR) if VAULT_DIR.exists() else None

def iter_all_categories(tree: dict):
    for node in tree.values():
        yield node
        yield from iter_all_categories(node["subcategorias"])

def all_concepts(tree: dict, uncategorized: list[dict], catalogos: dict | None = None) -> list[dict]:
    concepts: list[dict] = []
    for node in iter_all_categories(tree):
        concepts.extend(node["conceptos"])
    if catalogos:
        for node in iter_all_categories(catalogos):
            concepts.extend(node["conceptos"])
    concepts.extend(uncategorized)
    return concepts

def concept_url_static(c: dict, base_path: str) -> str:
    cat_path = c.get("_cat_path") or []
    if cat_path:
        return f"{base_path}/" + "/".join(cat_path) + f"/{c['_slug']}.html"
    return f"{base_path}/{c['_slug']}.html"

def category_url_static(slug_path: list[str], base_path: str) -> str:
    return f"{base_path}/" + "/".join(slug_path) + "/index.html"

def _up(n: int) -> str:
    return "/".join([".."] * n) if n > 0 else "."

_IMG_TAG_RE = re.compile(r"<img\b[^>]*>")
_ATTR_SRC_RE = re.compile(r'\bsrc="([^"]*)"')
_ATTR_ALT_RE = re.compile(r'\balt="([^"]*)"')

def resolve_asset_src(src: str, base_path: str) -> str:
    """Convierte una ruta absoluta '/static/...' escrita a mano en el markdown
    en una ruta relativa a base_path, para que funcione sin importar desde
    dónde se sirva el sitio (subcarpeta, file://, etc). Deja intactas las
    rutas ya relativas y las externas (http(s)://)."""
    if src.startswith(("http://", "https://", "//")):
        return src
    if src.startswith("/"):
        prefix = base_path if base_path and base_path != "." else "."
        return f"{prefix}{src}"
    return src

jinja_env.globals["resolve_asset_src"] = resolve_asset_src

def resolve_asset_srcs_in_html(html: str, base_path: str) -> str:
    """Reescribe todos los src=\"/...\" (de <img>) y href=\"/...\" (de <a>,
    enlaces internos) dentro de un bloque de HTML ya renderizado, para que
    las rutas absolutas escritas a mano en el markdown (p. ej.
    /static/img/obras/x.jpg o /matematicas/monadas.html) funcionen sin
    importar desde dónde se sirva el sitio."""
    if not html or ("src=\"/" not in html and "href=\"/" not in html):
        return html
    def _fix(m: re.Match) -> str:
        return f'{m.group(1)}="{resolve_asset_src(m.group(2), base_path)}"'
    return re.sub(r'(src|href)="(/[^"]*)"', _fix, html)

def first_image_from_body(body: str | None) -> tuple[str, str] | None:
    if not body:
        return None
    m = _IMG_TAG_RE.search(body)
    if not m:
        return None
    tag = m.group(0)
    src_m = _ATTR_SRC_RE.search(tag)
    if not src_m:
        return None
    alt_m = _ATTR_ALT_RE.search(tag)
    return src_m.group(1), (alt_m.group(1) if alt_m else "")

def extract_first_image(body: str | None) -> tuple[tuple[str, str] | None, str]:
    if not body:
        return None, body or ""
    m = _IMG_TAG_RE.search(body)
    if not m:
        return None, body
    tag = m.group(0)
    src_m = _ATTR_SRC_RE.search(tag)
    if not src_m:
        return None, body
    alt_m = _ATTR_ALT_RE.search(tag)
    img = (src_m.group(1), alt_m.group(1) if alt_m else "")
    wrapped = f"<p>{tag}</p>"
    if wrapped in body:
        remaining = body.replace(wrapped, "", 1)
    else:
        remaining = body.replace(tag, "", 1)
    return img, remaining

def latest_from_catalogo(catalogos: dict, folder_name: str, n: int) -> list[dict]:
    node = catalogos.get(folder_name)
    if node is None:
        # Fallback case-insensitive: la carpeta puede estar en disco con otra
        # combinación de mayúsculas/minúsculas (p. ej. "obras" en vez de "Obras").
        target = folder_name.casefold()
        for key, value in catalogos.items():
            if key.casefold() == target:
                node = value
                break
    if not node:
        return []
    conceptos = sorted(node["conceptos"], key=lambda c: c.get("_mtime") or 0, reverse=True)
    return conceptos[:n]

def compile_once() -> int:
    t0 = time.perf_counter()

    if PUBLIC_DIR.exists():
        shutil.rmtree(PUBLIC_DIR)
    PUBLIC_DIR.mkdir(parents=True)

    dst_static = PUBLIC_DIR / "static"
    if STATIC_DIR.exists():
        if dst_static.exists():
            shutil.rmtree(dst_static)
        shutil.copytree(STATIC_DIR, dst_static)

    tree, catalogos = load_tree()
    uncategorized   = load_uncategorized()
    welcome         = load_welcome()
    concepts        = all_concepts(tree, uncategorized, catalogos)

    latest_concepts = sorted(
        concepts, key=lambda c: c.get("_mtime") or 0, reverse=True
    )[:5]

    sidebar_latest   = latest_concepts[:5]
    sidebar_lecturas = latest_from_catalogo(catalogos, "Lecturas", n=5)
    sidebar_obra     = latest_from_catalogo(catalogos, "Obras", n=1)
    sidebar_obra_img = first_image_from_body(sidebar_obra[0].get("body")) if sidebar_obra else None

    tagline = "Un espacio personal de notas y conceptos."

    base_ctx = dict(
        tree=tree,
        catalogos=catalogos,
        concepts=concepts,
        uncategorized=uncategorized,
        welcome=welcome,
        concept_url_static=concept_url_static,
        category_url_static=category_url_static,
        first_image_from_body=first_image_from_body,
        extract_first_image=extract_first_image,
        tagline=tagline,
        sidebar_latest=sidebar_latest,
        sidebar_lecturas=sidebar_lecturas,
        sidebar_obra=(sidebar_obra[0] if sidebar_obra else None),
        sidebar_obra_img=sidebar_obra_img,
    )

    search_index = []
    for node in list(iter_all_categories(tree)) + list(iter_all_categories(catalogos)):
        search_index.append({
            "title": node["label"],
            "url":   category_url_static(node["_slug_path"], ""),
            "meta":  "Categoría",
        })
    for c in concepts:
        cat_path = c.get("_cat_path") or []
        root = tree.get(cat_path[0]) or catalogos.get(cat_path[0]) if cat_path else None
        root_label = root["label"] if root else "Sin categoría"
        search_index.append({
            "title": c.get("concept", ""),
            "url":   concept_url_static(c, ""),
            "meta":  root_label,
        })
    (PUBLIC_DIR / "search-index.json").write_text(
        json.dumps(search_index, ensure_ascii=False),
        encoding="utf-8",
    )

    (PUBLIC_DIR / "index.html").write_text(
        render("static_index.html", **base_ctx,
               latest_concepts=latest_concepts, base_path="."),
        encoding="utf-8",
    )

    def write_category(node: dict) -> None:
        sp      = node["_slug_path"]
        bp      = _up(len(sp))
        out_dir = PUBLIC_DIR.joinpath(*sp)
        out_dir.mkdir(parents=True, exist_ok=True)

        if node["subcategorias"]:
            areas_html = render_areas_box(node["subcategorias"], sp[0], sp, bp)
            if node.get("index"):
                body = node["index"].get("body") or ""
                if _AREAS_PLACEHOLDER in body:
                    body = (
                        body.replace(f"<p>{_AREAS_PLACEHOLDER}</p>", areas_html)
                            .replace(_AREAS_PLACEHOLDER, areas_html)
                    )
                else:
                    body = body + "\n\n" + areas_html
                node["index"]["body"] = body
            else:
                node["index"] = {"body": areas_html}

        if node.get("index") and node["index"].get("body"):
            node["index"]["body"] = group_wiki_boxes(node["index"]["body"])

        campo = node
        if campo.get("index") and campo["index"].get("body"):
            campo = dict(node)
            campo["index"] = dict(node["index"])
            campo["index"]["body"] = resolve_asset_srcs_in_html(campo["index"]["body"], bp)

        (out_dir / "index.html").write_text(
            render("static_campo.html", **base_ctx,
                   slug_path=sp, campo=campo,
                   active_root_slug=sp[0], base_path=bp),
            encoding="utf-8",
        )
        for sub in node["subcategorias"].values():
            write_category(sub)

    for node in list(tree.values()) + list(catalogos.values()):
        write_category(node)

    by_slug = {c["_slug"]: c for c in concepts if c.get("_slug")}
    for concept in concepts:
        cat_path = concept.get("_cat_path") or []

        if concept.get("body"):
            concept["body"] = group_wiki_boxes(concept["body"])

        if cat_path:
            out_dir = PUBLIC_DIR.joinpath(*cat_path)
            bp      = _up(len(cat_path))
        else:
            out_dir = PUBLIC_DIR
            bp      = "."

        out_dir.mkdir(parents=True, exist_ok=True)
        template = "static_lecture.html" if concept.get("layout") == "lecture" \
            else "static_concept.html"

        page_concept = concept
        if concept.get("body"):
            page_concept = dict(concept)
            page_concept["body"] = resolve_asset_srcs_in_html(concept["body"], bp)

        (out_dir / f"{concept['_slug']}.html").write_text(
            render(template, **base_ctx,
                   concept=page_concept,
                   active_slug=concept["_slug"],
                   active_root_slug=(cat_path[0] if cat_path else None),
                   base_path=bp),
            encoding="utf-8",
        )

    elapsed = time.perf_counter() - t0
    log.info("Compilado: %d páginas en %.2fs", len(concepts), elapsed)
    return len(concepts)

DEBOUNCE_SECONDS = 1.5

def _make_handler():
    try:
        from watchdog.events import FileSystemEventHandler
    except ImportError:
        log.error("watchdog no instalado. Ejecuta: pip install watchdog")
        sys.exit(1)

    class _Handler(FileSystemEventHandler):
        def __init__(self) -> None:
            self._timer: threading.Timer | None = None
            self._lock  = threading.Lock()

        def on_any_event(self, event):
            if PUBLIC_DIR.name in str(event.src_path):
                return
            src = Path(event.src_path)
            if src.suffix not in (".md", ".html", ".css") and not src.is_dir():
                return
            with self._lock:
                if self._timer:
                    self._timer.cancel()
                self._timer = threading.Timer(DEBOUNCE_SECONDS, self._rebuild)
                self._timer.daemon = True
                self._timer.start()

        def _rebuild(self) -> None:
            log.info("Cambio detectado — recompilando…")
            try:
                compile_once()
            except Exception as exc:
                log.error("Error al compilar: %s", exc)

    return _Handler()

def start_watcher() -> None:
    try:
        from watchdog.observers import Observer
    except ImportError:
        log.error("watchdog no instalado. Ejecuta: pip install watchdog")
        sys.exit(1)

    handler  = _make_handler()
    observer = Observer()
    for watch_dir in (VAULT_DIR, TEMPLATES_DIR, STATIC_DIR):
        if watch_dir.exists():
            observer.schedule(handler, str(watch_dir), recursive=True)

    observer.start()
    log.info("Watcher activo — observando %s, %s, %s",
             VAULT_DIR, TEMPLATES_DIR, STATIC_DIR)
    return observer

def start_server(port: int = 8000) -> None:
    handler = http.server.SimpleHTTPRequestHandler
    original_cwd = Path.cwd()

    class _Handler(http.server.SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=str(PUBLIC_DIR), **kwargs)

        def log_message(self, fmt, *args):
            pass

    server = http.server.HTTPServer(("", port), _Handler)
    t = threading.Thread(target=server.serve_forever, daemon=True)
    t.start()
    log.info("Servidor: http://localhost:%d", port)

def main() -> None:
    parser = argparse.ArgumentParser(description="Begriff — compilador estático")
    parser.add_argument("--watch",  action="store_true", help="Observar cambios y recompilar")
    parser.add_argument("--serve",  action="store_true", help="Servir public/ en localhost:8000")
    parser.add_argument("--port",   type=int, default=8000)
    args = parser.parse_args()

    try:
        compile_once()
    except Exception:
        log.exception("Error en compilación inicial")
        sys.exit(1)

    if not args.watch and not args.serve:
        return

    if args.serve:
        start_server(args.port)

    if args.watch or args.serve:
        observer = start_watcher()
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            log.info("Deteniendo…")
            observer.stop()
        observer.join()

if __name__ == "__main__":
    main()
