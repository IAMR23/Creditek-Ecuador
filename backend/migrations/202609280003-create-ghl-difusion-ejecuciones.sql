CREATE TABLE IF NOT EXISTS ghl_difusion_ejecuciones (
  id BIGSERIAL PRIMARY KEY,
  estado VARCHAR(30) NOT NULL DEFAULT 'pending',
  mensaje TEXT NOT NULL,
  "instanceIndexes" INTEGER[] NOT NULL,
  "batchSize" INTEGER NOT NULL DEFAULT 3 CHECK ("batchSize" BETWEEN 1 AND 20),
  "intervalMinutes" INTEGER NOT NULL DEFAULT 5 CHECK ("intervalMinutes" BETWEEN 1 AND 1440),
  "tagName" VARCHAR(100) NOT NULL DEFAULT 'regestion',
  total INTEGER NOT NULL DEFAULT 0,
  processed INTEGER NOT NULL DEFAULT 0,
  sent INTEGER NOT NULL DEFAULT 0,
  failed INTEGER NOT NULL DEFAULT 0,
  tagged INTEGER NOT NULL DEFAULT 0,
  "tagFailed" INTEGER NOT NULL DEFAULT 0,
  excluded JSONB NOT NULL DEFAULT '[]'::jsonb,
  "creadoPorId" INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  "scheduledAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "startedAt" TIMESTAMPTZ,
  "finishedAt" TIMESTAMPTZ,
  "nextBatchAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "heartbeatAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ghl_difusion_ejecuciones_estado_check
    CHECK (estado IN ('pending', 'running', 'completed', 'partial', 'cancelled'))
);

CREATE TABLE IF NOT EXISTS ghl_difusion_ejecucion_detalles (
  id BIGSERIAL PRIMARY KEY,
  "ejecucionId" BIGINT NOT NULL REFERENCES ghl_difusion_ejecuciones(id) ON DELETE CASCADE,
  "contactId" VARCHAR(100) NOT NULL,
  "contactName" VARCHAR(250) NOT NULL,
  "instanceIndex" INTEGER NOT NULL,
  estado VARCHAR(30) NOT NULL DEFAULT 'pending',
  "messageId" VARCHAR(150),
  "sendError" TEXT,
  "tagStatus" VARCHAR(30) NOT NULL DEFAULT 'pending',
  "tagError" TEXT,
  "processedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ghl_difusion_detalles_estado_check
    CHECK (estado IN ('pending', 'processing', 'sent', 'failed', 'cancelled')),
  CONSTRAINT ghl_difusion_detalles_tag_estado_check
    CHECK ("tagStatus" IN ('pending', 'tagged', 'failed', 'skipped', 'cancelled')),
  CONSTRAINT ghl_difusion_detalles_contact_unique UNIQUE ("ejecucionId", "contactId")
);

CREATE INDEX IF NOT EXISTS ghl_difusion_ejecucion_due_idx
  ON ghl_difusion_ejecuciones (estado, "nextBatchAt");
CREATE INDEX IF NOT EXISTS ghl_difusion_ejecucion_usuario_idx
  ON ghl_difusion_ejecuciones ("creadoPorId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS ghl_difusion_ejecucion_programada_idx
  ON ghl_difusion_ejecuciones ("scheduledAt" DESC);
CREATE INDEX IF NOT EXISTS ghl_difusion_detalle_estado_idx
  ON ghl_difusion_ejecucion_detalles ("ejecucionId", estado);

CREATE INDEX IF NOT EXISTS ghl_difusion_ejecucion_activa_fecha_idx
  ON ghl_difusion_ejecuciones ("nextBatchAt", id)
  WHERE estado IN ('pending', 'running');

-- Reversion manual omitida deliberadamente para conservar el historial.
