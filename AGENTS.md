# Instrucciones para agentes IA

## Resolución obligatoria del proyecto

Este repositorio contiene dos aplicaciones independientes. Resolver siempre el
alias indicado por el usuario antes de inspeccionar o modificar archivos:

| Alias del usuario | Backend activo | Frontend activo |
| --- | --- | --- |
| `Proyecto RVE` o `RVE` | `backend/` | `frontend/` |
| `ABS` o `Proyecto ABS` | `backend_apolo/` | `frontend_apolo/` |

- Si el usuario dice `backend` o `frontend` después de indicar un alias, se
  refiere a la carpeta correspondiente de ese proyecto activo.
- El último alias explícito se conserva en las instrucciones de continuación
  hasta que el usuario cambie de proyecto.
- No trasladar cambios al otro proyecto por similitud. Solo tocar ambos cuando
  el usuario lo solicite de forma explícita.
- Si un alias contradice una ruta escrita por el usuario, detener la edición y
  aclarar el alcance.
- `landingpage/` y `postgres-init/` quedan fuera de ambos alias y solo se
  modifican por instrucción explícita.

Antes de modificar este proyecto, revisar:

- .agents/contexto-rve.md
- .agents/reglas-codex.md
- .agents/prompts/backend.md
- .agents/prompts/frontend.md
- .agents/prompts/base-datos.md

Cuando corresponda, revisar también:

- `.agents/prompts/fullstack.md` para cambios de backend y frontend.
- `.agents/prompts/python-backend.md` para procesos Python de RVE.
- `.agents/arquitectura/backend.md` para arquitectura backend de RVE.

Reglas:
- Confirmar en la respuesta cuál fue el proyecto activo y sus carpetas.
- No romper producción.
- No subir credenciales.
- No cambiar rutas existentes sin justificación.
- No eliminar lógica antigua sin revisar impacto.
- Para cambios en DB, proponer SQL seguro.
- Para frontend, mantener estilo visual existente.
