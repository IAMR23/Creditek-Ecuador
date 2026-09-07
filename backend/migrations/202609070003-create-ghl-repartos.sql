-- Verificacion previa: las tres filas deben ser NULL antes de la primera aplicacion.
SELECT to_regclass('public.ghl_reparto_configuraciones'),
       to_regclass('public.ghl_reparto_ejecuciones'),
       to_regclass('public.ghl_reparto_ejecucion_detalles');

DO $$ BEGIN CREATE TYPE enum_ghl_reparto_configuraciones_modo AS ENUM ('unassigned', 'all');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE enum_ghl_reparto_ejecuciones_tipo AS ENUM ('scheduled', 'manual');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE enum_ghl_reparto_ejecuciones_estado AS ENUM ('running', 'completed', 'partial', 'failed', 'skipped');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE enum_ghl_reparto_ejecucion_detalles_estado AS ENUM ('assigned', 'skipped', 'error');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS ghl_reparto_configuraciones (
  id SERIAL PRIMARY KEY, nombre VARCHAR(160) NOT NULL, "pipelineId" VARCHAR(100) NOT NULL,
  "pipelineNombre" VARCHAR(200) NOT NULL, "stageId" VARCHAR(100) NOT NULL, "stageNombre" VARCHAR(200) NOT NULL,
  hora VARCHAR(5) NOT NULL CHECK (hora ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  "zonaHoraria" VARCHAR(50) NOT NULL DEFAULT 'America/Guayaquil' CHECK ("zonaHoraria" = 'America/Guayaquil'),
  "diasSemana" INTEGER[] NOT NULL CHECK (cardinality("diasSemana") > 0),
  modo enum_ghl_reparto_configuraciones_modo NOT NULL, "usuariosGhl" JSONB NOT NULL DEFAULT '[]'::jsonb,
  activo BOOLEAN NOT NULL DEFAULT TRUE, "indiceSiguienteUsuario" INTEGER NOT NULL DEFAULT 0,
  "creadoPorId" INTEGER NOT NULL REFERENCES usuarios(id), "actualizadoPorId" INTEGER NOT NULL REFERENCES usuarios(id),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(), "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ghl_reparto_ejecuciones (
  id BIGSERIAL PRIMARY KEY, "configuracionId" INTEGER NOT NULL REFERENCES ghl_reparto_configuraciones(id) ON DELETE RESTRICT,
  tipo enum_ghl_reparto_ejecuciones_tipo NOT NULL, "scheduledFor" TIMESTAMPTZ, "ventanaProgramada" VARCHAR(20),
  "startedAt" TIMESTAMPTZ NOT NULL, "finishedAt" TIMESTAMPTZ, estado enum_ghl_reparto_ejecuciones_estado NOT NULL,
  "pipelineNombre" VARCHAR(200) NOT NULL, "stageNombre" VARCHAR(200) NOT NULL,
  "totalEncontradas" INTEGER NOT NULL DEFAULT 0, "totalElegibles" INTEGER NOT NULL DEFAULT 0,
  "totalAsignadas" INTEGER NOT NULL DEFAULT 0, "totalOmitidas" INTEGER NOT NULL DEFAULT 0, "totalErrores" INTEGER NOT NULL DEFAULT 0,
  "ejecutadoPorId" INTEGER REFERENCES usuarios(id) ON DELETE SET NULL, "errorGeneral" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(), "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS ghl_reparto_ejecucion_ventana_unique
  ON ghl_reparto_ejecuciones ("configuracionId", "ventanaProgramada") WHERE "ventanaProgramada" IS NOT NULL;
CREATE INDEX IF NOT EXISTS ghl_reparto_ejecucion_config_fecha_idx ON ghl_reparto_ejecuciones ("configuracionId", "startedAt" DESC);
CREATE UNIQUE INDEX IF NOT EXISTS ghl_reparto_ejecucion_activa_unique ON ghl_reparto_ejecuciones ("configuracionId") WHERE estado = 'running';

CREATE TABLE IF NOT EXISTS ghl_reparto_ejecucion_detalles (
  id BIGSERIAL PRIMARY KEY, "ejecucionId" BIGINT NOT NULL REFERENCES ghl_reparto_ejecuciones(id) ON DELETE CASCADE,
  "opportunityId" VARCHAR(100) NOT NULL, "previousAssignedTo" VARCHAR(100), "newAssignedTo" VARCHAR(100),
  estado enum_ghl_reparto_ejecucion_detalles_estado NOT NULL, "errorCode" VARCHAR(80), "errorMessage" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(), "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE ("ejecucionId", "opportunityId")
);

-- Verificacion posterior.
SELECT table_name FROM information_schema.tables WHERE table_name LIKE 'ghl_reparto_%' ORDER BY table_name;

-- Reversion manual segura (solo si no se requieren los historicos):
-- DROP TABLE ghl_reparto_ejecucion_detalles;
-- DROP TABLE ghl_reparto_ejecuciones;
-- DROP TABLE ghl_reparto_configuraciones;
-- DROP TYPE enum_ghl_reparto_ejecucion_detalles_estado;
-- DROP TYPE enum_ghl_reparto_ejecuciones_estado;
-- DROP TYPE enum_ghl_reparto_ejecuciones_tipo;
-- DROP TYPE enum_ghl_reparto_configuraciones_modo;
