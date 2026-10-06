BEGIN;

-- Retira únicamente la exclusión global. Las ejecuciones y sus detalles se conservan.
DROP INDEX IF EXISTS ghl_difusion_ejecucion_activa_unique;

-- Ayuda al scheduler a localizar varias campañas pendientes por fecha de lote.
CREATE INDEX IF NOT EXISTS ghl_difusion_ejecucion_activa_fecha_idx
  ON ghl_difusion_ejecuciones ("nextBatchAt", id)
  WHERE estado IN ('pending', 'running');

COMMIT;

SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'ghl_difusion_ejecuciones'
ORDER BY indexname;
