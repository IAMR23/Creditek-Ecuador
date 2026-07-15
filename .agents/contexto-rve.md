# Contexto del repositorio - Creditek Ecuador

Este repositorio contiene dos proyectos internos independientes.

## Alias y carpetas

| Alias | Backend | Frontend |
| --- | --- | --- |
| Proyecto RVE / RVE | `backend/` | `frontend/` |
| ABS / Proyecto ABS | `backend_apolo/` | `frontend_apolo/` |

Reglas de interpretación:

- Resolver el proyecto activo antes de buscar o editar código.
- Cuando el usuario ya indicó `RVE` o `ABS`, las palabras `backend` y
  `frontend` se refieren a las carpetas de ese alias.
- Mantener aislados ambos proyectos. No replicar cambios entre ellos salvo
  petición explícita.
- No asumir que archivos, middlewares, permisos o rutas tienen el mismo nombre
  en RVE y ABS; verificar siempre la implementación del proyecto activo.

## Contexto RVE

Stack:
- Backend: Node.js, Express, Sequelize, PostgreSQL
- Frontend: React + Vite
- UI: Tailwind / estilos existentes
- Mapas: Leaflet + OpenStreetMap
- Auth: JWT
- Despliegue: Docker / VPS

## Diferencias conocidas de ABS

- El backend usa `backend_apolo/middleware/auth.js`; no usa el middleware de
  autenticación de RVE.
- El frontend usa `frontend_apolo/src/api/client.js`, `App.jsx`, `Sidebar.jsx`
  y `ProtectedRoute.jsx`.
- ABS no tiene actualmente `frontend_apolo/src/config/routePermissions.js`.
  No crearlo ni copiar el de RVE sin validar que el cambio lo requiera.

Reglas generales:
- No romper producción.
- No cambiar rutas existentes sin justificar.
- No eliminar lógica antigua sin revisar impacto.
- Mantener compatibilidad con datos existentes.
- Validar permisos por rol y usuario.
- Evitar exponer datos personales en reportes.
