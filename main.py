"""
ALETHEIA — Motor local de fichero técnico personal.
Servidor Flask ligero + compilador de sitio estático.
"""

import os
import json
import re
import unicodedata
import shutil
from pathlib import Path
from flask import Flask, render_template, request, redirect, url_for, jsonify

# ── Dependencias de scraping (opcionales pero recomendadas) ──────────────────
try:
    import requests
    from readability import Document
    SCRAPER = "readability"
except ImportError:
    try:
        import requests
        from bs4 import BeautifulSoup
        SCRAPER = "bs4"
    except ImportError:
        SCRAPER = None

app = Flask(__name__)

DATA_DIR  = Path("data")
PUBLIC_DIR = Path("public")
TEMPLATES_DIR = Path("templates")


# ════════════════════════════════════════════════════════════════════════════
# UTILIDADES DE DATOS
# ════════════════════════════════════════════════════════════════════════════

def slugify(text: str) -> str:
    """Convierte texto a nombre de carpeta/archivo seguro."""
    text = unicodedata.normalize("NFD", text)
    text = text.encode("ascii", "ignore").decode("ascii")
    text = text.lower().strip()
    text = re.sub(r"[^\w\s-]", "", text)
    text = re.sub(r"[\s_-]+", "_", text)
    return text


def load_tree() -> dict:
    """
    Lee la estructura de data/ y devuelve un dict anidado:
    { campo_slug: { label, ramas: { rama_slug: { label, conceptos: [concept_obj] } } } }
    """
    tree = {}
    if not DATA_DIR.exists():
        return tree

    for campo_path in sorted(DATA_DIR.iterdir()):
        if not campo_path.is_dir():
            continue
        campo_slug = campo_path.name
        campo_label = campo_slug.replace("_", " ").title()
        tree[campo_slug] = {"label": campo_label, "ramas": {}}

        for rama_path in sorted(campo_path.iterdir()):
            if not rama_path.is_dir():
                continue
            rama_slug = rama_path.name
            rama_label = rama_slug.replace("_", " ").title()
            conceptos = []

            for json_file in sorted(rama_path.glob("*.json")):
                with open(json_file, encoding="utf-8") as f:
                    data = json.load(f)
                data["_slug"]       = json_file.stem
                data["_campo_slug"] = campo_slug
                data["_rama_slug"]  = rama_slug
                data["_path"]       = str(json_file)
                conceptos.append(data)

            tree[campo_slug]["ramas"][rama_slug] = {
                "label": rama_label,
                "conceptos": conceptos,
            }

    return tree


def load_concept(campo_slug: str, rama_slug: str, concept_slug: str) -> dict | None:
    path = DATA_DIR / campo_slug / rama_slug / f"{concept_slug}.json"
    if not path.exists():
        return None
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    data["_slug"]       = concept_slug
    data["_campo_slug"] = campo_slug
    data["_rama_slug"]  = rama_slug
    return data


def all_concepts(tree: dict) -> list:
    """Lista plana de todos los conceptos, ordenados por campo > rama."""
    flat = []
    for campo in tree.values():
        for rama in campo["ramas"].values():
            flat.extend(rama["conceptos"])
    return flat


# ════════════════════════════════════════════════════════════════════════════
# SCRAPING
# ════════════════════════════════════════════════════════════════════════════

def fetch_content(url: str) -> str:
    """Extrae el cuerpo legible de una URL. Devuelve texto plano."""
    if not SCRAPER or not url:
        return ""
    try:
        headers = {"User-Agent": "Mozilla/5.0 (compatible; Aletheia/1.0)"}
        resp = requests.get(url, timeout=10, headers=headers)
        resp.raise_for_status()

        if SCRAPER == "readability":
            doc = Document(resp.text)
            # Extrae solo el resumen de texto (sin HTML)
            from html.parser import HTMLParser

            class _Strip(HTMLParser):
                def __init__(self):
                    super().__init__()
                    self.parts = []
                def handle_data(self, data):
                    self.parts.append(data)

            p = _Strip()
            p.feed(doc.summary())
            return " ".join(p.parts).strip()

        else:  # bs4
            soup = BeautifulSoup(resp.text, "html.parser")
            for tag in soup(["script", "style", "nav", "footer", "header"]):
                tag.decompose()
            main = (
                soup.find("article")
                or soup.find("main")
                or soup.find(id=re.compile(r"content|main|article", re.I))
                or soup.body
            )
            return (main.get_text(separator=" ", strip=True) if main else "")[:4000]

    except Exception as exc:
        return f"[Error al obtener contenido: {exc}]"


# ════════════════════════════════════════════════════════════════════════════
# COMPILADOR ESTÁTICO
# ════════════════════════════════════════════════════════════════════════════

def compile_static():
    """
    Lee data/ y genera public/ con HTML estático listo para GitHub Pages.
    Estructura de salida:
        public/
            index.html           (índice global)
            {campo}/{rama}/{slug}.html
    """
    PUBLIC_DIR.mkdir(exist_ok=True)
    tree = load_tree()
    concepts = all_concepts(tree)

    # ── Copiar CSS estático ──────────────────────────────────────────────
    static_src = Path("static")
    static_dst = PUBLIC_DIR / "static"
    if static_src.exists():
        if static_dst.exists():
            shutil.rmtree(static_dst)
        shutil.copytree(static_src, static_dst)

    # ── Índice global ────────────────────────────────────────────────────
    index_html = render_template(
        "static_index.html",
        tree=tree,
        concepts=concepts,
        active_concept=None,
        base_path="",        # raíz del sitio estático
    )
    (PUBLIC_DIR / "index.html").write_text(index_html, encoding="utf-8")

    # ── Una ficha por concepto ───────────────────────────────────────────
    for concept in concepts:
        campo_slug   = concept["_campo_slug"]
        rama_slug    = concept["_rama_slug"]
        concept_slug = concept["_slug"]

        out_dir = PUBLIC_DIR / campo_slug / rama_slug
        out_dir.mkdir(parents=True, exist_ok=True)

        # Profundidad relativa hasta la raíz (para hrefs)
        base_path = "../../.."

        card_html = render_template(
            "static_concept.html",
            tree=tree,
            concept=concept,
            active_slug=concept_slug,
            base_path=base_path,
        )
        (out_dir / f"{concept_slug}.html").write_text(card_html, encoding="utf-8")

    return len(concepts)


# ════════════════════════════════════════════════════════════════════════════
# RUTAS — APLICACIÓN LOCAL
# ════════════════════════════════════════════════════════════════════════════

@app.route("/")
def index():
    tree = load_tree()
    concepts = all_concepts(tree)
    return render_template("app.html", tree=tree, concepts=concepts,
                           view="index", concept=None)


@app.route("/concept/<campo_slug>/<rama_slug>/<concept_slug>")
def view_concept(campo_slug, rama_slug, concept_slug):
    tree    = load_tree()
    concept = load_concept(campo_slug, rama_slug, concept_slug)
    if not concept:
        return redirect(url_for("index"))
    concepts = all_concepts(tree)
    return render_template("app.html", tree=tree, concepts=concepts,
                           view="concept", concept=concept,
                           active_slug=concept_slug)


@app.route("/add", methods=["GET"])
def add_form():
    tree     = load_tree()
    concepts = all_concepts(tree)
    return render_template("app.html", tree=tree, concepts=concepts,
                           view="add", concept=None)


@app.route("/add", methods=["POST"])
def add_concept():
    concept_name = request.form.get("concept", "").strip()
    campo_raw    = request.form.get("campo", "").strip()
    rama_raw     = request.form.get("rama", "").strip()
    source_url   = request.form.get("source_url", "").strip()
    local_summary = request.form.get("local_summary", "").strip()

    if not concept_name or not campo_raw or not rama_raw:
        tree     = load_tree()
        concepts = all_concepts(tree)
        return render_template("app.html", tree=tree, concepts=concepts,
                               view="add", concept=None,
                               error="Nombre, Campo y Rama son obligatorios.")

    campo_slug   = slugify(campo_raw)
    rama_slug    = slugify(rama_raw)
    concept_slug = slugify(concept_name)

    # Detectar campo label correcto (puede existir ya)
    campo_label = campo_raw
    rama_label  = rama_raw

    # Crear carpetas y archivo
    out_dir = DATA_DIR / campo_slug / rama_slug
    out_dir.mkdir(parents=True, exist_ok=True)

    # Construir field label a partir de partes existentes o nuevas
    field_label = f"{campo_label} / {rama_label}"

    # Scraping
    fetched = fetch_content(source_url) if source_url else ""

    payload = {
        "concept": concept_name,
        "field": field_label,
        "source_url": source_url,
        "local_summary": local_summary,
        "fetched_content": fetched,
    }

    json_path = out_dir / f"{concept_slug}.json"
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

    # Recompilar sitio estático
    compile_static()

    return redirect(url_for("view_concept",
                            campo_slug=campo_slug,
                            rama_slug=rama_slug,
                            concept_slug=concept_slug))


@app.route("/edit/<campo_slug>/<rama_slug>/<concept_slug>", methods=["GET"])
def edit_form(campo_slug, rama_slug, concept_slug):
    tree    = load_tree()
    concept = load_concept(campo_slug, rama_slug, concept_slug)
    if not concept:
        return redirect(url_for("index"))
    concepts = all_concepts(tree)
    return render_template("app.html", tree=tree, concepts=concepts,
                           view="edit", concept=concept,
                           active_slug=concept_slug)


@app.route("/edit/<campo_slug>/<rama_slug>/<concept_slug>", methods=["POST"])
def edit_concept(campo_slug, rama_slug, concept_slug):
    concept = load_concept(campo_slug, rama_slug, concept_slug)
    if not concept:
        return redirect(url_for("index"))

    concept["local_summary"]  = request.form.get("local_summary", "").strip()
    concept["source_url"]     = request.form.get("source_url", "").strip()
    concept["fetched_content"] = request.form.get("fetched_content", "").strip()

    # Refetch si se solicita
    if request.form.get("refetch") and concept["source_url"]:
        concept["fetched_content"] = fetch_content(concept["source_url"])

    # Limpiar claves internas antes de guardar
    save_data = {k: v for k, v in concept.items() if not k.startswith("_")}

    path = DATA_DIR / campo_slug / rama_slug / f"{concept_slug}.json"
    with open(path, "w", encoding="utf-8") as f:
        json.dump(save_data, f, ensure_ascii=False, indent=2)

    compile_static()

    return redirect(url_for("view_concept",
                            campo_slug=campo_slug,
                            rama_slug=rama_slug,
                            concept_slug=concept_slug))


@app.route("/delete/<campo_slug>/<rama_slug>/<concept_slug>", methods=["POST"])
def delete_concept(campo_slug, rama_slug, concept_slug):
    path = DATA_DIR / campo_slug / rama_slug / f"{concept_slug}.json"
    if path.exists():
        path.unlink()
    # Limpiar carpetas vacías
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


# ════════════════════════════════════════════════════════════════════════════
# PUNTO DE ENTRADA
# ════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    # Compilación inicial al arrancar
    compile_static()
    print("\n  ALETHEIA corriendo en  →  http://127.0.0.1:5000\n")
    app.run(debug=True, port=5000)
