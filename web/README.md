# Web de Electricitat Samsó

Una web estática generada con Python. El resultado (`dist/`) es HTML, CSS y JS puro, más un único PHP para el formulario.

## Requisitos
Python 3 con `jinja2` y `Pillow` (`pip install jinja2 pillow`).

## Comandos
```bash
python web/extraer.py      # (solo una vez) descarga textos e imágenes de la web antigua a ../contenido-original/
python web/build.py        # genera web/dist/ (web completa)
python web/build.py --boceto   # genera web/dist-boceto/ + web/esbos-electricitat-samso.zip (propuesta)
python -m http.server 8080 --directory web/dist   # ver en http://localhost:8080
```
En local el formulario muestra "modo demostración", porque no hay PHP.

**Boceto (esbós):**
- **Contenido:** portada, Il·luminació, contacto, solicitar servicio y una página "Disponible a la versió completa", solo en catalán.
- **Marcado como propuesta:** banda amarilla "no és la web oficial", `[Esbós]` en el título, `noindex` y `robots.txt` que bloquea a Google.
- **Sin backend:** sin PHP ni `.htaccess`; el formulario siempre está en modo demostración.
- **Se abre con doble clic** en `index.html`, sin servidor.
- **Qué páginas incluye:** se decide en `PAGINAS_BOCETO` (`build.py`). Los enlaces a páginas que no están llevan a `pendent.html`.
- Usa los mismos textos, plantillas y estilos que la web completa: cualquier cambio sale en las dos.

## Dónde se cambia cada cosa
| Qué | Archivo |
|---|---|
| Teléfono, email, dirección, horario, WhatsApp, fotos de portada | `contenido/comun.json` |
| Textos en catalán / castellano | `contenido/ca.json`, `contenido/es.json` |
| Estructura HTML | `plantillas/*.html` |
| Estilos | `static/css/estil.css` |
| Menú, galería, formularios | `static/js/main.js` |
| Envío del formulario (destinatario, remitente) | `static/php/enviar.php` |
| Redirecciones, caché, HTTPS | `static/htaccess.txt` (se publica como `.htaccess`) |

- **Horario:** `"horari": {"ca": "De dilluns a divendres, de 8 a 13 i de 15 a 19 h", "es": "..."}`. Aparece automáticamente en Contacto y en el pie.
- **WhatsApp:** `"whatsapp": "34600000000"`. Añade un botón en la barra del móvil.
- **Años de experiencia:** se calculan solos (año actual − 1960).

## Publicar (hosting CDmon)
1. Hacer una copia de seguridad de la web actual por FTP.
2. `python web/build.py`.
3. **Primero, prueba en una carpeta `/nova/`:**
   - Subir el contenido de `dist/` a `/nova/`.
   - Probar el formulario: tiene que llegar el correo.
   - Ojo: las redirecciones del `.htaccess` apuntan a la raíz. En `/nova/` puedes borrar el `.htaccess` mientras pruebas.
4. **Después, a la raíz:**
   - Subir `dist/` a la raíz, incluidos `.htaccess` y `cas/.htaccess`.
   - Borrar los archivos antiguos (`_layout/`, `_content/`, `index.htm`, `*_2.html`…). Las direcciones antiguas ya redirigen a las nuevas.
5. No tocar los DNS ni el correo.

**Formulario:**
- Requisitos: PHP ≥ 7.0 y la función `mail()` activa (CDmon la tiene).
- El remitente es `web@electricitatsamso.com`. Si los correos van a spam, crea ese buzón en CDmon o cambia `$REMITENT` por una dirección existente del dominio.
