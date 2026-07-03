# Prompt fullstack RVE

Usar este prompt cuando una tarea toque backend y frontend.

Trabajar solo en:

- `backend/`
- `frontend/`

No modificar:

- `backend_apolo/`
- `frontend_apolo/`
- Dockerfile
- docker-compose

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

- Crear rutas en `backend/routes`.
- Crear lógica en `backend/controllers`.
- Usar modelos existentes.
- Proteger rutas con `authenticate`.
- Usar `requirePermission` si aplica.

## Frontend

- Usar `frontend/src/api/client.js`.
- Si hay pantalla nueva, registrar en:
  - `App.jsx`
  - `Sidebar.jsx`
  - `routePermissions.js`

## Entregable

- Archivos modificados.
- Endpoints afectados.
- Pantallas afectadas.
- Permisos usados.
- Pruebas manuales.