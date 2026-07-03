# Arquitectura backend RVE

Backend Node.js + Express.

Estructura común:
- routes: define endpoints
- controllers: lógica HTTP
- services: lógica de negocio
- models: modelos Sequelize
- middleware: autenticación y permisos
- config/db: conexión a PostgreSQL

Convención recomendada:
- routes solo define rutas
- controllers valida request y responde
- services procesan lógica compleja
- models solo definen tablas