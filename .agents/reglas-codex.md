# Reglas para Codex en este proyecto

Antes de modificar:
1. Revisa backend y frontend relacionados.
2. Identifica modelos, rutas, controladores y componentes afectados.
3. No asumas nombres de columnas. Verifica modelos Sequelize.
4. No cambies estructura de base de datos sin proponer migración.
5. No elimines código funcional sin explicar.
6. Mantén los endpoints actuales.
7. Si hay riesgo en producción, propone cambio incremental.

Formato de respuesta esperado:
- Archivos modificados
- Qué se cambió
- Riesgos
- Pruebas manuales
- Comandos para ejecutar