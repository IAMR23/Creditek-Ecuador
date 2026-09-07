-- Verificacion previa: no modifica ni elimina ejecuciones existentes.
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name IN ('ghl_reparto_ejecuciones', 'ghl_reparto_ejecucion_detalles')
ORDER BY table_name, ordinal_position;

ALTER TYPE enum_ghl_reparto_ejecuciones_estado ADD VALUE IF NOT EXISTS 'pause_requested';
ALTER TYPE enum_ghl_reparto_ejecuciones_estado ADD VALUE IF NOT EXISTS 'paused';
ALTER TYPE enum_ghl_reparto_ejecuciones_estado ADD VALUE IF NOT EXISTS 'cancel_requested';
ALTER TYPE enum_ghl_reparto_ejecuciones_estado ADD VALUE IF NOT EXISTS 'cancelled';
ALTER TYPE enum_ghl_reparto_ejecuciones_estado ADD VALUE IF NOT EXISTS 'interrupted';
ALTER TYPE enum_ghl_reparto_ejecucion_detalles_estado ADD VALUE IF NOT EXISTS 'pending';
ALTER TYPE enum_ghl_reparto_ejecucion_detalles_estado ADD VALUE IF NOT EXISTS 'cancelled';

ALTER TABLE ghl_reparto_ejecuciones
  ADD COLUMN IF NOT EXISTS "pauseRequestedAt" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "pausedAt" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "resumedAt" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "cancelRequestedAt" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "heartbeatAt" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "processedCount" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE ghl_reparto_ejecucion_detalles
  ADD COLUMN IF NOT EXISTS retryable BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS "attemptCount" INTEGER NOT NULL DEFAULT 0;

DROP INDEX IF EXISTS ghl_reparto_ejecucion_activa_unique;
CREATE UNIQUE INDEX ghl_reparto_ejecucion_activa_unique
ON ghl_reparto_ejecuciones ("configuracionId")
WHERE estado IN ('running', 'pause_requested', 'paused', 'cancel_requested');

CREATE INDEX IF NOT EXISTS ghl_reparto_ejecucion_heartbeat_idx
ON ghl_reparto_ejecuciones (estado, "heartbeatAt");

-- Verificacion posterior.
SELECT id, "configuracionId", estado, "heartbeatAt", "processedCount", "finishedAt"
FROM ghl_reparto_ejecuciones
ORDER BY id DESC
LIMIT 20;

-- Reversion manual compatible (no ejecutarla si existen filas con estados nuevos):
-- DROP INDEX IF EXISTS ghl_reparto_ejecucion_heartbeat_idx;
-- DROP INDEX IF EXISTS ghl_reparto_ejecucion_activa_unique;
-- CREATE UNIQUE INDEX ghl_reparto_ejecucion_activa_unique
--   ON ghl_reparto_ejecuciones ("configuracionId") WHERE estado = 'running';
-- ALTER TABLE ghl_reparto_ejecucion_detalles DROP COLUMN IF EXISTS "attemptCount", DROP COLUMN IF EXISTS retryable;
-- ALTER TABLE ghl_reparto_ejecuciones DROP COLUMN IF EXISTS "processedCount", DROP COLUMN IF EXISTS "heartbeatAt",
--   DROP COLUMN IF EXISTS "cancelledAt", DROP COLUMN IF EXISTS "cancelRequestedAt", DROP COLUMN IF EXISTS "resumedAt",
--   DROP COLUMN IF EXISTS "pausedAt", DROP COLUMN IF EXISTS "pauseRequestedAt";
-- PostgreSQL no permite retirar valores ENUM de forma segura sin recrear el tipo; se conservan por compatibilidad.
