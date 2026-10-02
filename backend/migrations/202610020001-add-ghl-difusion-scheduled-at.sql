-- Conserva la fecha original solicitada para ejecuciones inmediatas o programadas.
ALTER TABLE IF EXISTS ghl_difusion_ejecuciones
  ADD COLUMN IF NOT EXISTS "scheduledAt" TIMESTAMPTZ;

UPDATE ghl_difusion_ejecuciones
SET "scheduledAt" = COALESCE("scheduledAt", "createdAt");

ALTER TABLE IF EXISTS ghl_difusion_ejecuciones
  ALTER COLUMN "scheduledAt" SET DEFAULT NOW(),
  ALTER COLUMN "scheduledAt" SET NOT NULL;

CREATE INDEX IF NOT EXISTS ghl_difusion_ejecucion_programada_idx
  ON ghl_difusion_ejecuciones ("scheduledAt" DESC);

-- Verificacion sugerida:
-- SELECT id, estado, "scheduledAt", "nextBatchAt", "createdAt"
-- FROM ghl_difusion_ejecuciones ORDER BY id DESC LIMIT 20;

-- Reversion manual omitida para no perder la fecha historica de programacion.
