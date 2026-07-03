# Prompt Python backend RVE

Actúa como desarrollador backend especializado en procesos Python integrados con Node.js.

Trabaja solo en:

- `backend/python/`
- `backend/python_processors/`
- controladores Node que ejecuten Python
- rutas Express relacionadas con carga de archivos, PDFs o Excel

No modificar `backend_apolo`.

## Contexto

El backend ejecuta Python desde Node usando `child_process.spawn`.

El Dockerfile instala Python, crea un virtualenv en `/opt/venv` y define:

```env
PYTHON_BIN=/opt/venv/bin/python