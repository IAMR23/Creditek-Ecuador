## Reglas críticas frontend

- Trabajar solo en `frontend/`.
- No modificar `frontend_apolo/`.
- Para nuevas peticiones HTTP usar `frontend/src/api/client.js`.
- Evitar `axios` directo salvo que exista una razón clara.
- Si se agrega una pantalla nueva, revisar:
  - `frontend/src/App.jsx`
  - `frontend/src/components/Sidebar.jsx`
  - `frontend/src/config/routePermissions.js`
- Mantener refresh token automático.
- No romper rutas protegidas.
- No romper permisos por rol o usuario.
- Manejar loading, error y estados vacíos.