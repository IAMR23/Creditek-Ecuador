CREATE TABLE IF NOT EXISTS ghl_reparto_revisiones_pendientes (
  "locationId" VARCHAR(100) PRIMARY KEY,
  "requestedVersion" BIGINT NOT NULL DEFAULT 0,
  "processedVersion" BIGINT NOT NULL DEFAULT 0,
  "lastTrigger" VARCHAR(30) NOT NULL DEFAULT 'play',
  "requestedAt" TIMESTAMPTZ NOT NULL,
  "processedAt" TIMESTAMPTZ,
  "failureCount" INTEGER NOT NULL DEFAULT 0,
  "retryAfter" TIMESTAMPTZ,
  "lastFailureCode" VARCHAR(80),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ghl_reparto_revision_versiones_check
    CHECK ("requestedVersion" >= 0 AND "processedVersion" >= 0)
);

ALTER TABLE ghl_reparto_revisiones_pendientes
  ADD COLUMN IF NOT EXISTS "failureCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "retryAfter" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "lastFailureCode" VARCHAR(80);

-- Puede ejecutarse nuevamente. Este bloque tambien cubre el caso en que
-- Sequelize haya creado la tabla antes de aplicar esta migracion.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ghl_reparto_revision_versiones_check'
      AND conrelid = 'ghl_reparto_revisiones_pendientes'::regclass
  ) THEN
    ALTER TABLE ghl_reparto_revisiones_pendientes
      ADD CONSTRAINT ghl_reparto_revision_versiones_check
      CHECK ("requestedVersion" >= 0 AND "processedVersion" >= 0);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ghl_reparto_revision_fallos_check'
      AND conrelid = 'ghl_reparto_revisiones_pendientes'::regclass
  ) THEN
    ALTER TABLE ghl_reparto_revisiones_pendientes
      ADD CONSTRAINT ghl_reparto_revision_fallos_check
      CHECK ("failureCount" >= 0);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS ghl_reparto_revision_pendiente_idx
  ON ghl_reparto_revisiones_pendientes ("requestedAt")
  WHERE "requestedVersion" > "processedVersion";
