-- Verificacion previa.
SELECT to_regclass('public.ghl_reparto_webhook_eventos');

BEGIN;

CREATE TABLE IF NOT EXISTS ghl_reparto_webhook_eventos (
  id BIGSERIAL PRIMARY KEY,
  "idempotencyKey" VARCHAR(64) NOT NULL,
  estado VARCHAR(24) NOT NULL DEFAULT 'received',
  "resultCode" VARCHAR(80),
  "configuracionId" INTEGER,
  "opportunityId" VARCHAR(100),
  "contactId" VARCHAR(100),
  "locationId" VARCHAR(100),
  "workflowId" VARCHAR(100),
  source VARCHAR(120),
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "lockedAt" TIMESTAMPTZ,
  "processedAt" TIMESTAMPTZ,
  "lastError" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS ghl_reparto_webhook_eventos_idempotency_unique
  ON ghl_reparto_webhook_eventos ("idempotencyKey");

CREATE INDEX IF NOT EXISTS ghl_reparto_webhook_eventos_estado_fecha_idx
  ON ghl_reparto_webhook_eventos (estado, "createdAt");

COMMIT;

-- Verificacion posterior.
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name = 'ghl_reparto_webhook_eventos';

SELECT indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'ghl_reparto_webhook_eventos'
ORDER BY indexname;
