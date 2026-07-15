## Reglas críticas backend

- Resolver primero el backend activo:
  - RVE: `backend/`.
  - ABS: `backend_apolo/`.
- Trabajar solo en el backend activo y no modificar el backend del otro
  proyecto, salvo instrucción explícita.
- Revisar el middleware de autenticación real del backend activo; no copiar el
  de un proyecto al otro.
- No romper `req.user`.
- No cambiar nombres de endpoints existentes sin justificación.
- No crear rutas administrativas públicas.
- No imprimir tokens, contraseñas o datos sensibles.
- No modificar Dockerfile salvo instrucción explícita.

### RVE (`backend/`)

- Toda ruta privada debe usar `authenticate`.
- Si la ruta pertenece a Contabilidad, Gerencia, Sistemas, Auditoría,
  Administración o Logística, revisar si debe usar `requirePermission`.
- No cambiar la estructura del token sin revisar `routes/authRoutes.js`,
  `middleware/authMiddleware.js` y `utils/tokenConfig.js` dentro de `backend/`.
- Si el cambio toca PDFs, Excel o Python, revisar también
  `.agents/prompts/python-backend.md`.

### ABS (`backend_apolo/`)

- Las rutas privadas usan `middleware/auth.js`; verificar su exportación y la
  forma de `req.user` antes de cambiar autenticación.
- Antes de cambiar tokens, revisar `backend_apolo/routes/authRoutes.js` y
  `backend_apolo/middleware/auth.js`.
- No asumir que ABS dispone de `requirePermission` ni de la misma estructura de
  permisos de RVE; comprobar modelos y rutas existentes.
