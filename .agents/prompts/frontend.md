## Reglas críticas frontend

- Resolver primero el frontend activo:
  - RVE: `frontend/`.
  - ABS: `frontend_apolo/`.
- Trabajar solo en el frontend activo y no modificar el frontend del otro
  proyecto, salvo instrucción explícita.
- Para nuevas peticiones HTTP usar `src/api/client.js` dentro del frontend
  activo.
- Evitar `axios` directo salvo que exista una razón clara.
- Si se agrega una pantalla nueva, revisar:
  - `src/App.jsx` del frontend activo.
  - `src/components/Sidebar.jsx` del frontend activo.
  - En RVE, `frontend/src/config/routePermissions.js`.
  - En ABS, los componentes de rutas protegidas existentes. No asumir que
    existe `routePermissions.js`.
- Mantener refresh token automático.
- No romper rutas protegidas.
- No romper permisos por rol o usuario.
- Manejar loading, error y estados vacíos.
