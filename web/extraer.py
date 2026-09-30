"""Descarga el contenido (textos + imágenes) de la web actual de Electricitat Samsó.

Solo contenido: no baja el CSS/JS/PHP antiguos.
Resultado en ../contenido-original/
  textos/ca/*.md, textos/es/*.md   texto de cada página
  imagenes/...                      imágenes con su ruta original
  galerias.json                     fotos de cada servicio (foto grande + miniatura)
"""
import html
import json
import re
import urllib.parse
import urllib.request
from pathlib import Path

BASE = "https://electricitatsamso.com/"
RAIZ = Path(__file__).resolve().parent.parent / "contenido-original"
SERVEIS = ["electricitat", "aigua", "liquids-gasos", "refrigeracio-climatitzacio",
           "energies-renovables", "illuminacio", "extintors", "manteniment"]
PAGINAS_EXTRA = {"electricitat": 2, "aigua": 2, "liquids-gasos": 2, "illuminacio": 3}
IDIOMAS = {"ca": "", "es": "cas/"}


def get(url, binario=False):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    datos = urllib.request.urlopen(req, timeout=30).read()
    return datos if binario else datos.decode("utf-8", "replace")


def paginas(prefijo):
    """(nombre, ruta) de todas las páginas de un idioma."""
    res = [("inici", "index.htm" if not prefijo else "index.html"), ("experiencia", "experiencia.html"),
           ("serveis", "serveis.html"), ("contacte", "contacte.html"), ("sollicitar-servei", "sollicitar-servei.php")]
    for s in SERVEIS:
        res.append((f"serveis/{s}", f"serveis/{s}.html"))
        for n in range(2, PAGINAS_EXTRA.get(s, 1) + 1):
            res.append((f"serveis/{s}_{n}", f"serveis/{s}_{n}.html"))
    return [(n, prefijo + r) for n, r in res]


def a_texto(fragmento):
    """HTML del bloque #content -> markdown sencillo."""
    f = re.sub(r"<!--.*?(-->|$)", "", fragmento, flags=re.S)
    f = re.sub(r'<ul class="(side-nav|pagination)[^"]*">.*?</ul>', "", f, flags=re.S)
    f = re.sub(r"<(script|style|form|iframe)\b.*?</\1>", "", f, flags=re.S | re.I)
    f = re.sub(r"<h[1-6][^>]*>(.*?)</h[1-6]>", r"\n\n## \1\n\n", f, flags=re.S)
    f = re.sub(r"<(br)\s*/?>", "\n", f, flags=re.I)
    f = re.sub(r"</(p|li|blockquote|div)>", "\n\n", f, flags=re.I)
    f = re.sub(r"<[^>]+>", "", f)
    f = html.unescape(f)
    lineas = [re.sub(r"[ \t]+", " ", l).strip() for l in f.splitlines()]
    texto = "\n".join(lineas)
    return re.sub(r"\n{3,}", "\n\n", texto).strip() + "\n"


def main():
    imagenes = set()
    galerias = {s: [] for s in SERVEIS}
    for idioma, prefijo in IDIOMAS.items():
        for nombre, ruta in paginas(prefijo):
            url = BASE + ruta
            doc = get(url)
            titulo = re.search(r"<title>(.*?)</title>", doc, re.S)
            desc = re.search(r'name="description" content="([^"]*)"', doc)
            bloque = re.search(r'<div id="content">(.*?)end #content', doc, re.S)
            cuerpo = a_texto(bloque.group(1) if bloque else doc)
            destino = RAIZ / "textos" / idioma / f"{nombre}.md"
            destino.parent.mkdir(parents=True, exist_ok=True)
            cabecera = (f"<!-- origen: {url} -->\n<!-- title: {html.unescape(titulo.group(1).strip()) if titulo else ''} -->\n"
                        f"<!-- description: {desc.group(1).strip() if desc else ''} -->\n\n")
            destino.write_text(cabecera + cuerpo, encoding="utf-8")
            print("texto", idioma, nombre)

            refs = re.findall(r'(?:src|href)="([^"]+\.(?:jpe?g|png|gif))"', doc, re.I)
            refs += re.findall(r"url\(([^)]+\.(?:jpe?g|png|gif))\)", doc, re.I)
            for r in refs:
                absoluta = urllib.parse.urljoin(url, r)
                if absoluta.startswith(BASE + "_content/") or absoluta.endswith("_layout/images/logo.png"):
                    imagenes.add(absoluta)

            # galerías (solo una vez, desde el catalán)
            servei = nombre.split("/")[-1].split("_")[0]
            if idioma == "ca" and servei in galerias:
                for grande, mini in re.findall(r'<a href="([^"]+)"[^>]*rel="prettyPhoto[^>]*>\s*<img src="([^"]+)"', doc):
                    item = {"foto": urllib.parse.urljoin(url, grande).replace(BASE, ""),
                            "mini": urllib.parse.urljoin(url, mini).replace(BASE, "")}
                    if item not in galerias[servei]:
                        galerias[servei].append(item)

    for url in sorted(imagenes):
        destino = RAIZ / "imagenes" / url.replace(BASE, "")
        if destino.exists():
            continue
        destino.parent.mkdir(parents=True, exist_ok=True)
        try:
            destino.write_bytes(get(url, binario=True))
            print("imagen", destino.relative_to(RAIZ))
        except Exception as e:
            print("ERROR", url, e)

    (RAIZ / "galerias.json").write_text(json.dumps(galerias, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"\n{len(imagenes)} imágenes, galerías: " + ", ".join(f"{k}={len(v)}" for k, v in galerias.items()))


if __name__ == "__main__":
    main()
