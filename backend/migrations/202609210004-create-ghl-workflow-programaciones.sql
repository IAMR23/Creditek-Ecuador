-- Verificacion previa: en una primera aplicacion las tres referencias son NULL.
SELECT to_regclass('public.ghl_workflow_programaciones'),
       to_regclass('public.ghl_workflow_ejecuciones'),
       to_regclass('public.ghl_workflow_ejecucion_detalles');

DO $$ BEGIN
  CREATE TYPE enum_ghl_workflow_ejecuciones_tipo AS ENUM ('scheduled', 'manual');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE enum_ghl_workflow_ejecuciones_estado AS ENUM
    ('pending', 'running', 'completed', 'partial', 'failed', 'interrupted', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE enum_ghl_workflow_ejecucion_detalles_estado AS ENUM
    ('pending', 'processing', 'success', 'failed_retryable', 'failed_final', 'skipped');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS ghl_workflow_programaciones (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(160) NOT NULL,
  "pipelineId" VARCHAR(100) NOT NULL,
  "pipelineNombre" VARCHAR(200) NOT NULL,
  "stageIds" VARCHAR(100)[] NOT NULL,
  "stageNombres" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "workflowId" VARCHAR(100) NOT NULL,
  "workflowNombre" VARCHAR(200) NOT NULL,
  hora VARCHAR(5) NOT NULL,
  "diasSemana" INTEGER[] NOT NULL,
  "zonaHoraria" VARCHAR(50) NOT NULL DEFAULT 'America/Guayaquil',
  "permitirReingreso" BOOLEAN NOT NULL DEFAULT FALSE,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  "creadoPorId" INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  "actualizadoPorId" INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ghl_workflow_programacion_hora_check
    CHECK (hora ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  CONSTRAINT ghl_workflow_programacion_timezone_check
    CHECK ("zonaHoraria" = 'America/Guayaquil'),
  CONSTRAINT ghl_workflow_programacion_stages_check
    CHECK (cardinality("stageIds") > 0),
  CONSTRAINT ghl_workflow_programacion_days_check
    CHECK (cardinality("diasSemana") > 0 AND "diasSemana" <@ ARRAY[0,1,2,3,4,5,6])
);
CREATE INDEX IF NOT EXISTS ghl_workflow_programacion_activa_hora_idx
  ON ghl_workflow_programaciones (activo, hora);

CREATE TABLE IF NOT EXISTS ghl_workflow_ejecuciones (
  id BIGSERIAL PRIMARY KEY,
  "configuracionId" INTEGER NOT NULL REFERENCES ghl_workflow_programaciones(id) ON DELETE RESTRICT,
  "ventanaProgramada" VARCHAR(80) NOT NULL,
  tipo enum_ghl_workflow_ejecuciones_tipo NOT NULL DEFAULT 'scheduled',
  estado enum_ghl_workflow_ejecuciones_estado NOT NULL DEFAULT 'pending',
  "scheduledFor" TIMESTAMPTZ NOT NULL,
  "fechaLocal" DATE NOT NULL,
  "startedAt" TIMESTAMPTZ,
  "finishedAt" TIMESTAMPTZ,
  "heartbeatAt" TIMESTAMPTZ,
  "totalEncontrado" INTEGER NOT NULL DEFAULT 0,
  "totalElegible" INTEGER NOT NULL DEFAULT 0,
  "totalDeduplicado" INTEGER NOT NULL DEFAULT 0,
  "totalProcesado" INTEGER NOT NULL DEFAULT 0,
  "totalOmitido" INTEGER NOT NULL DEFAULT 0,
  "totalFallido" INTEGER NOT NULL DEFAULT 0,
  "paginasConsultadas" INTEGER NOT NULL DEFAULT 0,
  "codigoGeneral" VARCHAR(80),
  "mensajeGeneral" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ghl_workflow_ejecucion_totales_check CHECK (
    "totalEncontrado" >= 0 AND "totalElegible" >= 0 AND "totalDeduplicado" >= 0
    AND "totalProcesado" >= 0 AND "totalOmitido" >= 0 AND "totalFallido" >= 0
  )
);
CREATE UNIQUE INDEX IF NOT EXISTS ghl_workflow_ejecucion_ventana_unique
  ON ghl_workflow_ejecuciones ("configuracionId", "ventanaProgramada");
CREATE INDEX IF NOT EXISTS ghl_workflow_ejecucion_estado_heartbeat_idx
  ON ghl_workflow_ejecuciones (estado, "heartbeatAt");
CREATE INDEX IF NOT EXISTS ghl_workflow_ejecucion_config_fecha_idx
  ON ghl_workflow_ejecuciones ("configuracionId", "scheduledFor" DESC);

CREATE TABLE IF NOT EXISTS ghl_workflow_ejecucion_detalles (
  id BIGSERIAL PRIMARY KEY,
  "ejecucionId" BIGINT NOT NULL REFERENCES ghl_workflow_ejecuciones(id) ON DELETE CASCADE,
  "configuracionId" INTEGER NOT NULL REFERENCES ghl_workflow_programaciones(id) ON DELETE RESTRICT,
  "contactId" VARCHAR(100) NOT NULL,
  "opportunityId" VARCHAR(100),
  "workflowId" VARCHAR(100) NOT NULL,
  "fechaLocal" DATE NOT NULL,
  estado enum_ghl_workflow_ejecucion_detalles_estado NOT NULL DEFAULT 'pending',
  intentos INTEGER NOT NULL DEFAULT 0 CHECK (intentos >= 0),
  "processedAt" TIMESTAMPTZ,
  "errorCode" VARCHAR(80),
  mensaje TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS ghl_workflow_detalle_contacto_unique
  ON ghl_workflow_ejecucion_detalles ("ejecucionId", "contactId", "workflowId");
CREATE INDEX IF NOT EXISTS ghl_workflow_detalle_reingreso_off_idx
  ON ghl_workflow_ejecucion_detalles ("configuracionId", "contactId", "workflowId", estado);
CREATE INDEX IF NOT EXISTS ghl_workflow_detalle_reingreso_day_idx
  ON ghl_workflow_ejecucion_detalles ("contactId", "workflowId", "fechaLocal", estado);

-- Verificacion posterior: confirma tablas, restricciones e indices creados.
SELECT table_name FROM information_schema.tables
WHERE table_name LIKE 'ghl_workflow_%' ORDER BY table_name;
SELECT indexname FROM pg_indexes
WHERE tablename LIKE 'ghl_workflow_%' ORDER BY indexname;

-- Reversion manual deliberadamente omitida: conservar historicos evita reinscripciones accidentales.
