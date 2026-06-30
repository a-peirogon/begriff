
import re
import json
import unicodedata
import shutil
import subprocess
from pathlib import Path

import frontmatter
import markdown as md_lib
from flask import Flask, render_template, request, redirect, url_for, jsonify

DEFUDDLE_DIR = Path(__file__).parent / "tools" / "defuddle"
DEFUDDLE_CLI = DEFUDDLE_DIR / "dist" / "cli.js"

app = Flask(__name__)

DATA_DIR   = Path("data")
PUBLIC_DIR = Path("public")

CLASSES = {
    "concept": {
        "label": "Concepto",
        "icon":  "C",
        "fields": [
            ("source_url", "Source URL", "url"),
        ],
        "scrape_field": "source_url",
    },
    "art": {
        "label": "Obra de arte",
        "icon":  "A",
        "fields": [
            ("artist",     "Artist",     "text"),
            ("medium",     "Medium",     "text"),
            ("period",     "Period",     "text"),
            ("year",       "Year",       "number"),
            ("source_url", "Source URL", "url"),
        ],
        "scrape_field": "source_url",
    },
    "book": {
        "label": "Libro",
        "icon":  "B",
        "fields": [
            ("author",      "Author",      "text"),
            ("year",        "Year",        "number"),
            ("publisher",   "Publisher",   "text"),
            ("isbn",        "ISBN",        "text"),
            ("status",      "Status (por leer / leyendo / leído)", "text"),
            ("rating",      "Rating (1-5)", "number"),
            ("source_url",  "Source URL",  "url"),
        ],
        "scrape_field": "source_url",
    },
}

DEFAULT_CLASS = "concept"

def get_class(class_key: str) -> dict:
    return CLASSES.get(class_key, CLASSES[DEFAULT_CLASS])

@app.context_processor
def inject_classes():

    return {"classes": CLASSES}

def slugify(text: str) -> str:
    text = unicodedata.normalize("NFD", text)
    text = text.encode("ascii", "ignore").decode("ascii")
    text = text.lower().strip()
    text = re.sub(r"[^\w\s-]", "", text)
    text = re.sub(r"[\s_-]+", "_", text)
    return text

def parse_md(path: Path) -> dict:

    post = frontmatter.load(str(path))
    body_html = render_markdown(post.content)
    data = dict(post.metadata)
    data["body"] = body_html
    data["_raw"] = post.content
    data.setdefault("_class", DEFAULT_CLASS)
    return data

_LATEX_PLACEHOLDER = "\x00LATEX{{{}}}\x00"
_BLOCK_MATH_RE  = re.compile(r"\$\$(.+?)\$\$", re.DOTALL)
_INLINE_MATH_RE = re.compile(r"(?<!\$)\$(?!\$)(.+?)(?<!\$)\$(?!\$)", re.DOTALL)

def render_markdown(text: str) -> str:
    stash = []

    def _stash(m):
        stash.append(m.group(0))
        return _LATEX_PLACEHOLDER.format(len(stash) - 1)

    protected = _BLOCK_MATH_RE.sub(_stash, text)
    protected = _INLINE_MATH_RE.sub(_stash, protected)

    html = md_lib.markdown(protected, extensions=["extra", "smarty", "toc"])

    def _unstash(m):
        return stash[int(m.group(1))]

    return re.sub(r"\x00LATEX\{(\d+)\}\x00", _unstash, html)

def write_md(path: Path, meta: dict, body: str) -> None:

    post = frontmatter.Post(body, **meta)
    path.write_text(frontmatter.dumps(post), encoding="utf-8")

def fetch_content(url: str) -> dict:

    empty = {"body": "", "title": "", "author": "", "site": ""}
    if not url:
        return empty

    if not DEFUDDLE_CLI.exists():
        return {**empty, "body": (
            "*[Defuddle no está compilado. Ejecuta: "
            "cd tools/defuddle && npm install]*"
        )}

    try:
        result = subprocess.run(
            ["node", str(DEFUDDLE_CLI), "parse", url, "--markdown", "--json"],
            capture_output=True, text=True, timeout=30,
        )
        if result.returncode != 0:
            err = result.stderr.strip() or result.stdout.strip() or "error desconocido"
            return {**empty, "body": f"*[Error al obtener contenido: {err}]*"}

        data = json.loads(result.stdout)
        return {
            "body":   data.get("content", "").strip(),
            "title":  data.get("title", "") or "",
            "author": data.get("author", "") or "",
            "site":   data.get("site", "") or "",
        }
    except subprocess.TimeoutExpired:
        return {**empty, "body": "*[Error: tiempo de espera agotado al obtener la URL]*"}
    except json.JSONDecodeError:
        return {**empty, "body": "*[Error: respuesta inválida del extractor]*"}
    except Exception as exc:
        return {**empty, "body": f"*[Error al obtener contenido: {exc}]*"}

def load_tree() -> dict:

    tree = {}
    if not DATA_DIR.exists():
        return tree

    for campo_path in sorted(DATA_DIR.iterdir()):
        if not campo_path.is_dir() or campo_path.name.startswith("_"):
            continue
        campo_slug  = campo_path.name
        campo_label = campo_slug.replace("_", " ").title()
        tree[campo_slug] = {"label": campo_label, "ramas": {}}

        for rama_path in sorted(campo_path.iterdir()):
            if not rama_path.is_dir():
                continue
            rama_slug  = rama_path.name
            rama_label = rama_slug.replace("_", " ").title()
            conceptos  = []

            for md_file in sorted(rama_path.glob("*.md")):
                data = parse_md(md_file)
                data["_slug"]       = md_file.stem
                data["_campo_slug"] = campo_slug
                data["_rama_slug"]  = rama_slug
                data["_path"]       = str(md_file)
                if "concept" not in data:
                    data["concept"] = md_file.stem.replace("_", " ").title()
                conceptos.append(data)

            tree[campo_slug]["ramas"][rama_slug] = {
                "label":     rama_label,
                "conceptos": conceptos,
            }

    return tree

def load_concept(campo_slug: str, rama_slug: str, concept_slug: str) -> dict | None:
    path = DATA_DIR / campo_slug / rama_slug / f"{concept_slug}.md"
    if not path.exists():
        return None
    data = parse_md(path)
    data["_slug"]       = concept_slug
    data["_campo_slug"] = campo_slug
    data["_rama_slug"]  = rama_slug
    data["_path"]       = str(path)
    if "concept" not in data:
        data["concept"] = concept_slug.replace("_", " ").title()
    return data

def all_concepts(tree: dict) -> list:
    flat = []
    for campo in tree.values():
        for rama in campo["ramas"].values():
            flat.extend(rama["conceptos"])
    return flat

def directory_options(tree: dict) -> list:

    options = []
    for campo_slug, campo in tree.items():
        for rama_slug, rama in campo["ramas"].items():
            options.append({
                "campo_slug":  campo_slug,
                "campo_label": campo["label"],
                "rama_slug":   rama_slug,
                "rama_label":  rama["label"],
            })
    return options

def compile_static():
    PUBLIC_DIR.mkdir(exist_ok=True)
    tree     = load_tree()
    concepts = all_concepts(tree)

    static_src = Path("static")
    static_dst = PUBLIC_DIR / "static"
    if static_src.exists():
        if static_dst.exists():
            shutil.rmtree(static_dst)
        shutil.copytree(static_src, static_dst)

    (PUBLIC_DIR / "index.html").write_text(
        render_template("static_index.html", tree=tree, concepts=concepts,
                        active_concept=None, base_path=""),
        encoding="utf-8",
    )

    for concept in concepts:
        out_dir = PUBLIC_DIR / concept["_campo_slug"] / concept["_rama_slug"]
        out_dir.mkdir(parents=True, exist_ok=True)
        cls = get_class(concept.get("_class", DEFAULT_CLASS))
        (out_dir / f"{concept['_slug']}.html").write_text(
            render_template("static_concept.html", tree=tree, concept=concept,
                            cls=cls, active_slug=concept["_slug"],
                            base_path="../../.."),
            encoding="utf-8",
        )

    return len(concepts)

@app.route("/")
def index():
    tree = load_tree()
    return render_template("app.html", tree=tree, concepts=all_concepts(tree),
                           view="index", concept=None)

@app.route("/concept/<campo_slug>/<rama_slug>/<concept_slug>")
def view_concept(campo_slug, rama_slug, concept_slug):
    tree    = load_tree()
    concept = load_concept(campo_slug, rama_slug, concept_slug)
    if not concept:
        return redirect(url_for("index"))
    cls = get_class(concept.get("_class", DEFAULT_CLASS))
    return render_template("app.html", tree=tree, concepts=all_concepts(tree),
                           view="concept", concept=concept, cls=cls,
                           active_slug=concept_slug)

@app.route("/add", methods=["GET"])
def add_form():
    tree = load_tree()
    class_key = request.args.get("class", DEFAULT_CLASS)
    cls = get_class(class_key)
    return render_template("app.html", tree=tree, concepts=all_concepts(tree),
                           view="add", concept=None,
                           classes=CLASSES, class_key=class_key, cls=cls,
                           dir_options=directory_options(tree))

@app.route("/add", methods=["POST"])
def add_concept():
    concept_name = request.form.get("concept", "").strip()
    class_key    = request.form.get("class_key", DEFAULT_CLASS).strip()
    cls          = get_class(class_key)

    campo_choice = request.form.get("campo_choice", "").strip()
    rama_choice  = request.form.get("rama_choice", "").strip()
    campo_new    = request.form.get("campo_new", "").strip()
    rama_new     = request.form.get("rama_new", "").strip()

    if campo_choice == "__new__":
        campo_raw = campo_new
    else:
        campo_raw = campo_choice

    if rama_choice == "__new__":
        rama_raw = rama_new
    else:
        rama_raw = rama_choice

    body = request.form.get("body", "").strip()

    if not concept_name or not campo_raw or not rama_raw:
        tree = load_tree()
        return render_template("app.html", tree=tree, concepts=all_concepts(tree),
                               view="add", concept=None,
                               classes=CLASSES, class_key=class_key, cls=cls,
                               dir_options=directory_options(tree),
                               error="Nombre, Campo y Rama son obligatorios.")

    campo_slug   = slugify(campo_raw)
    rama_slug    = slugify(rama_raw)
    concept_slug = slugify(concept_name)

    out_dir = DATA_DIR / campo_slug / rama_slug
    out_dir.mkdir(parents=True, exist_ok=True)

    meta = {
        "concept": concept_name,
        "field":   f"{campo_raw} / {rama_raw}",
        "_class":  class_key,
        "tags":    [],
        "related": [],
    }
    for key, _, _ in cls["fields"]:
        meta[key] = request.form.get(key, "").strip()

    scrape_field = cls.get("scrape_field")
    if scrape_field and meta.get(scrape_field) and not body:
        scraped = fetch_content(meta[scrape_field])
        body = scraped["body"]

        if not concept_name and scraped["title"]:
            meta["concept"] = scraped["title"]
        if scraped["author"]:
            meta["author"] = scraped["author"]
        if scraped["site"]:
            meta["site"] = scraped["site"]

    write_md(out_dir / f"{concept_slug}.md", meta, body)
    compile_static()

    return redirect(url_for("view_concept", campo_slug=campo_slug,
                            rama_slug=rama_slug, concept_slug=concept_slug))

@app.route("/edit/<campo_slug>/<rama_slug>/<concept_slug>", methods=["GET"])
def edit_form(campo_slug, rama_slug, concept_slug):
    tree    = load_tree()
    concept = load_concept(campo_slug, rama_slug, concept_slug)
    if not concept:
        return redirect(url_for("index"))
    cls = get_class(concept.get("_class", DEFAULT_CLASS))
    return render_template("app.html", tree=tree, concepts=all_concepts(tree),
                           view="edit", concept=concept, cls=cls,
                           active_slug=concept_slug)

@app.route("/edit/<campo_slug>/<rama_slug>/<concept_slug>", methods=["POST"])
def edit_concept(campo_slug, rama_slug, concept_slug):
    concept = load_concept(campo_slug, rama_slug, concept_slug)
    if not concept:
        return redirect(url_for("index"))

    class_key = concept.get("_class", DEFAULT_CLASS)
    cls = get_class(class_key)
    path = DATA_DIR / campo_slug / rama_slug / f"{concept_slug}.md"

    meta = {
        "concept": concept.get("concept", concept_slug),
        "field":   concept.get("field", ""),
        "_class":  class_key,
        "tags":    concept.get("tags", []),
        "related": concept.get("related", []),
    }
    for key, _, _ in cls["fields"]:
        meta[key] = request.form.get(key, "").strip()

    body = request.form.get("body", "").strip()

    scrape_field = cls.get("scrape_field")
    if request.form.get("refetch") and scrape_field and meta.get(scrape_field):
        scraped = fetch_content(meta[scrape_field])
        body = scraped["body"]
        if scraped["author"]:
            meta["author"] = scraped["author"]
        if scraped["site"]:
            meta["site"] = scraped["site"]

    write_md(path, meta, body)
    compile_static()

    return redirect(url_for("view_concept", campo_slug=campo_slug,
                            rama_slug=rama_slug, concept_slug=concept_slug))

@app.route("/delete/<campo_slug>/<rama_slug>/<concept_slug>", methods=["POST"])
def delete_concept(campo_slug, rama_slug, concept_slug):
    path = DATA_DIR / campo_slug / rama_slug / f"{concept_slug}.md"
    if path.exists():
        path.unlink()

    rama_dir  = DATA_DIR / campo_slug / rama_slug
    campo_dir = DATA_DIR / campo_slug
    if rama_dir.exists() and not any(rama_dir.iterdir()):
        rama_dir.rmdir()
    if campo_dir.exists() and not any(campo_dir.iterdir()):
        campo_dir.rmdir()

    compile_static()
    return redirect(url_for("index"))

@app.route("/compile", methods=["POST"])
def manual_compile():
    n = compile_static()
    return jsonify({"ok": True, "compiled": n})

if __name__ == "__main__":
    with app.app_context():
        compile_static()
    print("\n  ALETHEIA corriendo en  →  http://127.0.0.1:5000\n")
    app.run(debug=True, port=5000)
