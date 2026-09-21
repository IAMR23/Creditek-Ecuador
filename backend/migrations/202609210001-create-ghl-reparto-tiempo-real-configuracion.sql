-- Verificacion previa: la tabla puede no existir en la primera aplicacion.
SELECT to_regclass('public.ghl_reparto_tiempo_real_configuraciones');

BEGIN;

CREATE TABLE IF NOT EXISTS ghl_reparto_tiempo_real_configuraciones (
  id INTEGER PRIMARY KEY DEFAULT 1,
  "pipelineId" VARCHAR(100),
  "pipelineNombre" VARCHAR(200),
  "stageIds" VARCHAR(100)[] NOT NULL DEFAULT ARRAY[]::VARCHAR(100)[],
  "stageNombres" VARCHAR(200)[] NOT NULL DEFAULT ARRAY[]::VARCHAR(200)[],
  "maxPendientesPorAsesor" INTEGER NOT NULL DEFAULT 2,
  "indiceSiguienteUsuario" INTEGER NOT NULL DEFAULT 0,
  "horaPausaAutomatica" VARCHAR(5) NOT NULL DEFAULT '18:00',
  "actualizadoPorId" INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  activo BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ghl_reparto_tiempo_real_singleton_check CHECK (id = 1),
  CONSTRAINT ghl_reparto_tiempo_real_max_pendientes_check
    CHECK ("maxPendientesPorAsesor" BETWEEN 1 AND 1000),
  CONSTRAINT ghl_reparto_tiempo_real_hora_pausa_check
    CHECK ("horaPausaAutomatica" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  CONSTRAINT ghl_reparto_tiempo_real_etapas_consistentes_check
    CHECK (cardinality("stageIds") = cardinality("stageNombres")),
  CONSTRAINT ghl_reparto_tiempo_real_activo_check
    CHECK (NOT activo OR (
      "pipelineId" IS NOT NULL
      AND cardinality("stageIds") > 0
    ))
);

-- Si Sequelize alcanzo a crear la tabla antes de ejecutar esta migracion,
-- completa las restricciones sin recrearla ni perder datos.
ALTER TABLE ghl_reparto_tiempo_real_configuraciones
  ADD COLUMN IF NOT EXISTS "horaPausaAutomatica" VARCHAR(5) NOT NULL DEFAULT '18:00';

UPDATE ghl_reparto_tiempo_real_configuraciones
SET "horaPausaAutomatica" = '18:00'
WHERE "horaPausaAutomatica" IS NULL
   OR "horaPausaAutomatica" !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$';

ALTER TABLE ghl_reparto_tiempo_real_configuraciones
  ALTER COLUMN "horaPausaAutomatica" SET DEFAULT '18:00',
  ALTER COLUMN "horaPausaAutomatica" SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ghl_reparto_tiempo_real_singleton_check'
      AND conrelid = 'ghl_reparto_tiempo_real_configuraciones'::regclass
  ) THEN
    ALTER TABLE ghl_reparto_tiempo_real_configuraciones
      ADD CONSTRAINT ghl_reparto_tiempo_real_singleton_check CHECK (id = 1);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ghl_reparto_tiempo_real_hora_pausa_check'
      AND conrelid = 'ghl_reparto_tiempo_real_configuraciones'::regclass
  ) THEN
    ALTER TABLE ghl_reparto_tiempo_real_configuraciones
      ADD CONSTRAINT ghl_reparto_tiempo_real_hora_pausa_check
      CHECK ("horaPausaAutomatica" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ghl_reparto_tiempo_real_max_pendientes_check'
      AND conrelid = 'ghl_reparto_tiempo_real_configuraciones'::regclass
  ) THEN
    ALTER TABLE ghl_reparto_tiempo_real_configuraciones
      ADD CONSTRAINT ghl_reparto_tiempo_real_max_pendientes_check
      CHECK ("maxPendientesPorAsesor" BETWEEN 1 AND 1000);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ghl_reparto_tiempo_real_etapas_consistentes_check'
      AND conrelid = 'ghl_reparto_tiempo_real_configuraciones'::regclass
  ) THEN
    ALTER TABLE ghl_reparto_tiempo_real_configuraciones
      ADD CONSTRAINT ghl_reparto_tiempo_real_etapas_consistentes_check
      CHECK (cardinality("stageIds") = cardinality("stageNombres"));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ghl_reparto_tiempo_real_activo_check'
      AND conrelid = 'ghl_reparto_tiempo_real_configuraciones'::regclass
  ) THEN
    ALTER TABLE ghl_reparto_tiempo_real_configuraciones
      ADD CONSTRAINT ghl_reparto_tiempo_real_activo_check
      CHECK (NOT activo OR (
        "pipelineId" IS NOT NULL
        AND cardinality("stageIds") > 0
      ));
  END IF;
END $$;

-- Compatibilidad inicial: reutiliza los IDs reales de las etapas activas del
-- reparto sin propietario anterior. No interpreta nombres: elige el pipeline
-- con mas etapas activas y, en empate, el actualizado mas recientemente.
WITH candidatas AS (
  SELECT DISTINCT ON ("pipelineId", "stageId")
    "pipelineId",
    "pipelineNombre",
    "stageId",
    "stageNombre",
    "actualizadoPorId",
    "updatedAt"
  FROM ghl_reparto_configuraciones
  WHERE modo = 'unassigned'
    AND activo = TRUE
  ORDER BY "pipelineId", "stageId", "updatedAt" DESC
), pipeline_inicial AS (
  SELECT
    "pipelineId",
    MAX("pipelineNombre") AS "pipelineNombre",
    ARRAY_AGG("stageId" ORDER BY "stageId") AS "stageIds",
    ARRAY_AGG("stageNombre" ORDER BY "stageId") AS "stageNombres",
    (ARRAY_AGG("actualizadoPorId" ORDER BY "updatedAt" DESC))[1] AS "actualizadoPorId",
    MAX("updatedAt") AS "updatedAt"
  FROM candidatas
  GROUP BY "pipelineId"
  ORDER BY COUNT(*) DESC, MAX("updatedAt") DESC
  LIMIT 1
)
INSERT INTO ghl_reparto_tiempo_real_configuraciones (
  id, "pipelineId", "pipelineNombre", "stageIds", "stageNombres",
  "maxPendientesPorAsesor", "indiceSiguienteUsuario", "actualizadoPorId",
  activo, "createdAt", "updatedAt"
)
SELECT
  1, "pipelineId", "pipelineNombre", "stageIds", "stageNombres",
  2, 0, "actualizadoPorId", TRUE, NOW(), NOW()
FROM pipeline_inicial
ON CONFLICT (id) DO NOTHING;

-- Si no fue posible resolver IDs historicos, el reparto queda explicitamente
-- inactivo hasta que un administrador seleccione pipeline y etapas reales.
INSERT INTO ghl_reparto_tiempo_real_configuraciones (
  id, "stageIds", "stageNombres", "maxPendientesPorAsesor", activo,
  "createdAt", "updatedAt"
) VALUES (
  1, ARRAY[]::VARCHAR(100)[], ARRAY[]::VARCHAR(200)[], 2, FALSE, NOW(), NOW()
)
ON CONFLICT (id) DO NOTHING;

COMMIT;

-- Verificacion posterior: debe existir exactamente una fila y sus IDs no deben
-- contener duplicados. Una fila inactiva puede conservar una seleccion vacia.
SELECT
  id,
  "pipelineId",
  "pipelineNombre",
  "stageIds",
  "stageNombres",
  "maxPendientesPorAsesor",
  "horaPausaAutomatica",
  "actualizadoPorId",
  activo,
  "updatedAt"
FROM ghl_reparto_tiempo_real_configuraciones;

SELECT id
FROM ghl_reparto_tiempo_real_configuraciones
WHERE cardinality("stageIds") <> (
  SELECT COUNT(DISTINCT stage_id)
  FROM unnest("stageIds") AS etapas(stage_id)
);
