# Reglas para Codex en este proyecto

## Selección de alcance

1. Resolver primero el alias conforme a `AGENTS.md`:
   - RVE: `backend/` + `frontend/`.
   - ABS: `backend_apolo/` + `frontend_apolo/`.
2. Tratar el alias seleccionado como proyecto activo durante las instrucciones
   de continuación, hasta que el usuario indique otro.
3. No mezclar implementaciones, imports, configuraciones ni convenciones entre
   RVE y ABS.
4. Si no hay alias, usar las rutas explícitas y el contexto de la conversación.
   Si el alcance sigue siendo ambiguo y editar podría afectar al proyecto
   equivocado, preguntar antes de modificar.

Antes de modificar:
1. Revisa el backend y frontend relacionados del proyecto activo.
2. Identifica modelos, rutas, controladores y componentes afectados.
3. No asumas nombres de columnas. Verifica modelos Sequelize.
4. No cambies estructura de base de datos sin proponer migración.
5. No elimines código funcional sin explicar.
6. Mantén los endpoints actuales.
7. Si hay riesgo en producción, propone cambio incremental.

Formato de respuesta esperado:
- Proyecto activo y carpetas usadas
- Archivos modificados
- Qué se cambió
- Riesgos
- Pruebas manuales
- Comandos para ejecutar
