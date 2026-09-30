# Nueva web de Electricitat Samsó

Rediseño completo de https://electricitatsamso.com: adaptado al móvil, en catalán y castellano, estático y rápido.

| Carpeta | Qué es |
|---|---|
| `web/` | Generador (`build.py`), contenido, plantillas y estilos. Ver [web/README.md](web/README.md) |
| `web/dist/` | **Web completa generada**, lista para subir al hosting |
| `contenido-original/` | Textos e imágenes descargados de la web antigua (los usa `build.py`) |

```bash
pip install jinja2 pillow
python web/build.py            # web completa  -> web/dist/
python web/build.py --boceto   # esbós         -> web/dist-boceto/ (repositorio Mpinedo04/boceto, publicado en Vercel)
```
