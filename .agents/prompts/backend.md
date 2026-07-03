## Reglas críticas backend

- Trabajar solo en `backend/`.
- No modificar `backend_apolo/`.
- Toda ruta privada debe usar `authenticate`.
- Si la ruta pertenece a Contabilidad, Gerencia, Sistemas, Auditoría, Administración o Logística, revisar si debe usar `requirePermission`.
- No romper `req.user`.
- No cambiar estructura del token sin revisar `authRoutes.js`, `authMiddleware.js` y `utils/tokenConfig.js`.
- No cambiar nombres de endpoints existentes sin justificación.
- No crear rutas administrativas públicas.
- No imprimir tokens, contraseñas o datos sensibles.
- No modificar Dockerfile salvo instrucción explícita.
- Si el cambio toca PDFs, Excel o Python, revisar también `.agents/prompts/python-backend.md`.