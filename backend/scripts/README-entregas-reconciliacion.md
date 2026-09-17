# Reconciliación de entregas

Este procedimiento no infiere responsables ni estados. Trabaja sobre la base
configurada por las variables `DB_*` del proceso.

1. Aplicar `202609160001-entregas-integridad-historial.sql`.
2. Ejecutar el diagnóstico, que es `dry-run` por defecto:

   `npm run entregas:reconciliar`

3. Verificar cada entrega con Operaciones y preparar un JSON:

   ```json
   {
     "operaciones": [
       {
         "entregaId": 123,
         "responsableDestinoId": 456,
         "expectedVersion": 0,
         "motivo": "Responsable confirmado por Operaciones"
       }
     ]
   }
   ```

   `estadoVerificado` es opcional y solo se incluye si fue comprobado. Para una
   anomalía con varias asignaciones activas también son obligatorios
   `asignacionesActivasEsperadas` (todos los IDs observados) y
   `asignacionAnteriorIdParaReversion` (el período que una reversión restauraría).

4. Aplicar el plan de forma transaccional:

   `npm run entregas:reconciliar -- --apply --mapping plan.json --actor 7`

5. Repetir el dry-run y aplicar
   `202609160002-entregas-asignacion-activa-unica.sql`. Este segundo SQL aborta
   y enumera las entregas si aún existen responsables activos duplicados.

La salida de aplicación entrega un UUID. La reversión solo procede si la
entrega conserva exactamente la versión y asignación dejadas por ese plan:

`npm run entregas:reconciliar -- --apply --revert UUID --actor 7 --motivo "Reversión autorizada"`

