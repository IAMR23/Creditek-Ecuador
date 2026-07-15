# Prompt fullstack RVE / ABS

Usar este prompt cuando una tarea toque backend y frontend.

Resolver primero el proyecto activo:

| Alias | Backend activo | Frontend activo |
| --- | --- | --- |
| RVE | `backend/` | `frontend/` |
| ABS | `backend_apolo/` | `frontend_apolo/` |

- Trabajar solo en las dos carpetas del proyecto activo.
- No modificar las carpetas del otro proyecto salvo instrucción explícita.
- No asumir que RVE y ABS comparten middlewares o configuración de permisos.
- No modificar:
  - Dockerfile.
  - docker-compose.

## Flujo obligatorio

1. Identificar pantalla frontend afectada.
2. Identificar endpoint backend afectado.
3. Revisar permisos.
4. Revisar modelos Sequelize si aplica.
5. Implementar backend.
6. Implementar frontend.
7. Verificar rutas, sidebar y permisos.
8. Explicar pruebas manuales.

## Backend

- Crear rutas en `<backend_activo>/routes`.
- Crear lógica en la estructura existente del backend activo. RVE dispone de
  `controllers/`; verificar la organización de ABS antes de crear carpetas.
- Usar modelos existentes.
- Proteger rutas con el middleware propio del proyecto activo.
- En RVE usar `authenticate` y `requirePermission` si aplica.
- En ABS revisar `backend_apolo/middleware/auth.js`; no asumir que existe
  `requirePermission`.

## Frontend

- Usar `<frontend_activo>/src/api/client.js`.
- Si hay pantalla nueva, registrar en:
  - `src/App.jsx`.
  - `src/components/Sidebar.jsx` si corresponde.
  - En RVE, `src/config/routePermissions.js`.
  - En ABS, revisar `ProtectedRoute.jsx`; no asumir que existe
    `routePermissions.js`.

## Entregable

- Archivos modificados.
- Endpoints afectados.
- Pantallas afectadas.
- Permisos usados.
- Pruebas manuales.
