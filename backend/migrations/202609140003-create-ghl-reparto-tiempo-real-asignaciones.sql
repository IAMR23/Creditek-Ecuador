-- Verificacion previa.
SELECT to_regclass('public.ghl_reparto_tiempo_real_asignaciones');

BEGIN;

CREATE TABLE IF NOT EXISTS ghl_reparto_tiempo_real_asignaciones (
  id BIGSERIAL PRIMARY KEY,
  "opportunityId" VARCHAR(100) NOT NULL,
  "ghlUserId" VARCHAR(100) NOT NULL,
  "pipelineId" VARCHAR(100) NOT NULL,
  "stageId" VARCHAR(100) NOT NULL,
  "trigger" VARCHAR(30) NOT NULL,
  "assignedAt" TIMESTAMPTZ NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ghl_reparto_tiempo_real_asesor_fecha_idx
  ON ghl_reparto_tiempo_real_asignaciones ("ghlUserId", "assignedAt");

CREATE INDEX IF NOT EXISTS ghl_reparto_tiempo_real_oportunidad_fecha_idx
  ON ghl_reparto_tiempo_real_asignaciones ("opportunityId", "assignedAt");

COMMIT;

-- Verificacion posterior.
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name = 'ghl_reparto_tiempo_real_asignaciones';
