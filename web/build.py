"""Genera la web estática de Electricitat Samsó.

    python web/build.py            -> web/dist/          web completa (se sube tal cual al hosting)
    python web/build.py --boceto   -> web/dist-boceto/   esbós de propuesta: 4 páginas en catalán y castellano, marcado
                                                         como propuesta, sin PHP, abre con doble clic
                                                         + web/esbos-electricitat-samso.zip para enviar

Lee:  contenido/*.json, plantillas/*.html, static/, ../contenido-original/imagenes/
"""
import datetime
import hashlib
import json
import posixpath
import shutil
import sys
import zipfile
from pathlib import Path

from jinja2 import Environment, FileSystemLoader, StrictUndefined
from markupsafe import Markup
from PIL import Image, ImageOps

WEB = Path(__file__).resolve().parent
ORIG = WEB.parent / "contenido-original"
HOY = datetime.date.today()
PREFIJO = {"ca": "", "es": "cas/"}

BOCETO = "--boceto" in sys.argv
DIST = WEB / ("dist-boceto" if BOCETO else "dist")
IDIOMAS_BUILD = ["ca", "es"]
# páginas que entran en el esbós; el resto de enlaces lleva a pendent.html
PAGINAS_BOCETO = {"inici", "servei:illuminacio", "treballs", "eines", "contacte", "pressupost", "pendent"}

# tamaños de imagen: (ancho, alto) -> recorte exacto; (ancho, None) -> máx. ancho sin recortar
TAMANOS = {
    "card": (640, 480),
    "thumb": (480, 360),
    "full": (1280, None),
    "hero": (1400, None),
    "raw": (None, None),
}


def cargar(nombre):
    return json.loads((WEB / "contenido" / nombre).read_text(encoding="utf-8"))


def sustituir(obj, reemplazos):
    """Aplica {anys} y similares a todos los textos del contenido."""
    if isinstance(obj, str):
        for k, v in reemplazos.items():
            obj = obj.replace("{" + k + "}", str(v))
        return obj
    if isinstance(obj, list):
        return [sustituir(x, reemplazos) for x in obj]
    if isinstance(obj, dict):
        return {k: sustituir(v, reemplazos) for k, v in obj.items()}
    return obj


class Imagenes:
    """Convierte las imágenes originales a WebP (una sola vez por tamaño)."""

    def __init__(self):
        self.hechas = {}

    def __call__(self, origen, tipo="card", foco=None):
        """foco: (x, y) entre 0 y 1, punto que se conserva al recortar (por defecto, el centro)."""
        clave = (origen, tipo, tuple(foco) if foco else None)
        if clave in self.hechas:
            return self.hechas[clave]
        ruta = ORIG / "imagenes" / origen
        carpeta = Path(origen).parent.name
        destino_rel = f"img/{carpeta}/{Path(origen).stem}-{tipo}.webp"
        destino = DIST / destino_rel
        destino.parent.mkdir(parents=True, exist_ok=True)
        im = Image.open(ruta)
        im.seek(0)
        im = im.convert("RGB")
        ancho, alto = TAMANOS[tipo]
        if ancho and alto:
            im = ImageOps.fit(im, (ancho, alto), Image.LANCZOS, centering=tuple(foco) if foco else (0.5, 0.5))
        elif ancho and im.width > ancho:
            im = im.resize((ancho, round(im.height * ancho / im.width)), Image.LANCZOS)
        im.save(destino, "WEBP", quality=80, method=6)
        info = {"src": destino_rel, "w": im.width, "h": im.height}
        self.hechas[clave] = info
        return info


def rel(destino, actual):
    """Enlace relativo de la página `actual` a `destino`.
    Las index.html se enlazan como carpeta, salvo en el esbós, que debe funcionar abriéndolo con doble clic."""
    d = posixpath.dirname(actual) or "."
    if posixpath.basename(destino) == "index.html" and not BOCETO:
        r = posixpath.relpath(posixpath.dirname(destino) or ".", d)
        return "./" if r == "." else r + "/"
    return posixpath.relpath(destino, d)


def paginas(comun):
    """(clave, plantilla, ruta sin prefijo de idioma)."""
    res = [
        ("inici", "inici.html", "index.html"),
        ("serveis", "serveis.html", "serveis.html"),
        ("experiencia", "experiencia.html", "experiencia.html"),
        ("treballs", "treballs.html", "treballs.html"),
        ("eines", "eines.html", "eines.html"),
        ("contacte", "contacte.html", "contacte.html"),
        ("pressupost", "pressupost.html", "sollicitar-servei.html"),
        ("avis-legal", "legal.html", "avis-legal.html"),
        ("privacitat", "legal.html", "privacitat.html"),
        ("gracies", "simple.html", "gracies.html"),
        ("error404", "simple.html", "404.html"),
    ]
    res += [(f"servei:{s['slug']}", "servei.html", f"serveis/{s['slug']}.html") for s in comun["serveis"]]
    if BOCETO:
        res.append(("pendent", "simple.html", "pendent.html"))
        res = [p for p in res if p[0] in PAGINAS_BOCETO]
    return res


RUTAS = {"inici": "index.html", "serveis": "serveis.html", "experiencia": "experiencia.html",
         "treballs": "treballs.html", "eines": "eines.html",
         "contacte": "contacte.html", "pressupost": "sollicitar-servei.html",
         "avis-legal": "avis-legal.html", "privacitat": "privacitat.html"}


def json_ld(comun, t, url_home):
    a = comun["adreca"]
    datos = {
        "@context": "https://schema.org",
        "@type": "Electrician",
        "name": comun["empresa"],
        "url": url_home,
        "logo": comun["site"] + "/img/logo.png",
        "image": comun["site"] + "/img/og.jpg",
        "telephone": comun["telefon_link"],
        "email": comun["email"],
        "foundingDate": str(comun["fundacio"]),
        "description": t["paginas"]["inici"]["description"],
        "address": {"@type": "PostalAddress", "streetAddress": a["carrer"], "postalCode": a["cp"],
                    "addressLocality": a["poblacio"], "addressRegion": a["provincia"], "addressCountry": "ES"},
        "geo": {"@type": "GeoCoordinates", "latitude": comun["geo"]["lat"], "longitude": comun["geo"]["lng"]},
        "areaServed": "Penedès",
        "inLanguage": t["lang"],
    }
    return Markup(json.dumps(datos, ensure_ascii=False, indent=2).replace("</", "<\\/"))


def limpiar_dist():
    """Vacía DIST conservando .git (dist-boceto es el repositorio github.com/Mpinedo04/boceto)."""
    DIST.mkdir(exist_ok=True)
    for p in DIST.iterdir():
        if p.name == ".git":
            continue
        shutil.rmtree(p) if p.is_dir() else p.unlink()


def main():
    limpiar_dist()

    comun = cargar("comun.json")
    anys = HOY.year - comun["fundacio"]
    idiomas = {l: sustituir(cargar(f"{l}.json"), {"anys": anys}) for l in PREFIJO}
    galerias = json.loads((ORIG / "galerias.json").read_text(encoding="utf-8"))
    img = Imagenes()
    incluidas = {PREFIJO[l] + ruta for l in IDIOMAS_BUILD for _, _, ruta in paginas(comun)}

    # --- estáticos ---
    shutil.copytree(WEB / "static" / "css", DIST / "css")
    shutil.copytree(WEB / "static" / "js", DIST / "js")
    if not BOCETO:  # el esbós no lleva backend ni configuración de servidor
        shutil.copy(WEB / "static" / "php" / "enviar.php", DIST / "enviar.php")
        shutil.copy(WEB / "static" / "htaccess.txt", DIST / ".htaccess")
        (DIST / "cas").mkdir()
        (DIST / "cas" / ".htaccess").write_text("ErrorDocument 404 /cas/404.html\n", encoding="utf-8")
    version = hashlib.md5(b"".join(p.read_bytes() for p in sorted((WEB / "static").rglob("*")) if p.is_file())).hexdigest()[:8]

    # logo, favicon e imagen para compartir
    (DIST / "img").mkdir(exist_ok=True)
    logo = Image.open(ORIG / "imagenes" / "_layout/images/logo.png").convert("RGBA")
    logo.save(DIST / "img/logo.png", optimize=True)
    icono = logo.crop((0, 0, logo.height, logo.height))
    fondo = Image.new("RGBA", icono.size, "white")
    icono = Image.alpha_composite(fondo, icono).convert("RGB")
    icono.resize((180, 180), Image.LANCZOS).save(DIST / "img/apple-touch-icon.png")
    icono.resize((32, 32), Image.LANCZOS).save(DIST / "img/favicon-32.png")
    icono.save(DIST / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])
    og = ImageOps.fit(Image.open(ORIG / "imagenes" / comun["hero"]).convert("RGB"), (1200, 630), Image.LANCZOS)
    og.save(DIST / "img/og.jpg", quality=82)

    env = Environment(loader=FileSystemLoader(WEB / "plantillas"), autoescape=True,
                      undefined=StrictUndefined, trim_blocks=True, lstrip_blocks=True)
    env.globals.update(comun=comun, anys=anys, any_actual=HOY.year, img=img, galerias=galerias, boceto=BOCETO)

    mapa_sitio = []
    for lang in IDIOMAS_BUILD:
        t = idiomas[lang]
        otro = "es" if lang == "ca" else "ca"
        for clave, plantilla, ruta in paginas(comun):
            actual = PREFIJO[lang] + ruta
            es_404 = clave == "error404"

            def url(destino, lang_destino=lang, _actual=actual, _abs=es_404):
                prefijo = "" if destino == "enviar.php" else PREFIJO[lang_destino]
                completo = prefijo + RUTAS.get(destino, destino)
                if BOCETO and completo not in incluidas:
                    completo = PREFIJO[lang_destino] + "pendent.html"
                if _abs:  # la 404 se sirve desde cualquier ruta: enlaces absolutos
                    return "/" + (completo[: -len("index.html")] if completo.endswith("index.html") else completo)
                return rel(completo, _actual)

            def asset(destino, _actual=actual, _abs=es_404):
                sufijo = f"?v={version}" if destino.endswith((".css", ".js")) else ""
                return ("/" + destino if _abs else posixpath.relpath(destino, posixpath.dirname(_actual) or ".")) + sufijo

            def absoluta(ruta_lang, l):
                completo = PREFIJO[l] + ruta_lang
                return comun["site"] + "/" + (completo[: -len("index.html")] if completo.endswith("index.html") else completo)

            servei = clave.split(":", 1)[1] if clave.startswith("servei:") else None
            info = t["serveis"][servei] if servei else t["paginas"][clave]
            ctx = dict(
                t=t, ui=t["ui"], lang=lang, clave=clave, servei=servei, info=info,
                url=url, asset=asset,
                canonical=absoluta(ruta, lang),
                alternativa=absoluta(ruta, otro), url_otro=url(ruta, otro), idioma_otro=idiomas[otro]["nom_idioma"],
                lang_otro=otro, indexable=not BOCETO and clave not in ("gracies", "error404"),
                json_ld=json_ld(comun, t, absoluta("index.html", lang)),
                idiomas={l: absoluta(ruta, l) for l in PREFIJO},
            )
            html = env.get_template(plantilla).render(**ctx)
            destino = DIST / actual
            destino.parent.mkdir(parents=True, exist_ok=True)
            destino.write_text(html, encoding="utf-8")
            if ctx["indexable"]:
                mapa_sitio.append((ctx["canonical"], ctx["idiomas"]))
            print("  ", actual)

    if BOCETO:
        (DIST / "robots.txt").write_text("User-agent: *\nDisallow: /\n", encoding="utf-8")
        # Vercel: web estática sin build; cabecera noindex en todo por si alguien enlaza el esbós
        (DIST / "vercel.json").write_text(json.dumps({
            "buildCommand": "", "outputDirectory": ".", "framework": None,
            "headers": [{"source": "/(.*)", "headers": [{"key": "X-Robots-Tag", "value": "noindex, nofollow"}]}],
        }, indent=2) + "\n", encoding="utf-8")
        (DIST / "README.md").write_text(
            "# Esbós · nova web d'Electricitat Samsó\n\n"
            "Proposta de disseny (no és la web oficial). Carpeta generada automàticament amb "
            "`python web/build.py --boceto` des del repositori `completa`: no s'edita a mà.\n\n"
            "Es publica a Vercel tal qual (web estàtica, sense build).\n", encoding="utf-8")
        # zip para enviar al cliente: sin .git ni los archivos de Vercel/GitHub
        zip_ = WEB / "esbos-electricitat-samso.zip"
        with zipfile.ZipFile(zip_, "w", zipfile.ZIP_DEFLATED) as z:
            for p in sorted(DIST.rglob("*")):
                rel_zip = p.relative_to(DIST)
                if p.is_file() and rel_zip.parts[0] not in (".git", "vercel.json", "README.md"):
                    z.write(p, rel_zip.as_posix())
        total = sum(p.stat().st_size for p in DIST.rglob("*") if p.is_file() and ".git" not in p.relative_to(DIST).parts)
        print(f"\nOK esbós: {sum(1 for _ in DIST.rglob('*.html'))} páginas, {total / 1e6:.1f} MB en {DIST}\n    zip: {zip_}")
        return

    # --- sitemap y robots ---
    urls = []
    for loc, alts in mapa_sitio:
        enlaces = "".join(f'\n    <xhtml:link rel="alternate" hreflang="{l}" href="{u}"/>' for l, u in alts.items())
        urls.append(f"  <url>\n    <loc>{loc}</loc>\n    <lastmod>{HOY.isoformat()}</lastmod>{enlaces}\n  </url>")
    (DIST / "sitemap.xml").write_text(
        '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" '
        'xmlns:xhtml="http://www.w3.org/1999/xhtml">\n' + "\n".join(urls) + "\n</urlset>\n", encoding="utf-8")
    (DIST / "robots.txt").write_text(f"User-agent: *\nAllow: /\n\nSitemap: {comun['site']}/sitemap.xml\n", encoding="utf-8")

    total = sum(p.stat().st_size for p in DIST.rglob("*") if p.is_file())
    print(f"\nOK: {sum(1 for _ in DIST.rglob('*.html'))} páginas, {len(img.hechas)} imágenes, {total / 1e6:.1f} MB en {DIST}")


if __name__ == "__main__":
    main()
