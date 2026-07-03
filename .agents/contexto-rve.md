# Contexto RVE - Creditek Ecuador

Proyecto interno de Creditek Ecuador.

Stack:
- Backend: Node.js, Express, Sequelize, PostgreSQL
- Frontend: React + Vite
- UI: Tailwind / estilos existentes
- Mapas: Leaflet + OpenStreetMap
- Auth: JWT
- Despliegue: Docker / VPS

Reglas generales:
- No romper producción.
- No cambiar rutas existentes sin justificar.
- No eliminar lógica antigua sin revisar impacto.
- Mantener compatibilidad con datos existentes.
- Validar permisos por rol y usuario.
- Evitar exponer datos personales en reportes.