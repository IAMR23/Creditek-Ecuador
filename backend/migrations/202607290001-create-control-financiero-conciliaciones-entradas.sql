BEGIN;

SELECT
  to_regclass('public.control_financiero_conciliaciones_entradas')
    AS tabla_conciliaciones_antes;

CREATE TABLE IF NOT EXISTS control_financiero_conciliaciones_entradas (
  id BIGSERIAL PRIMARY KEY,
  "ejecucionId" UUID NOT NULL,
  "cargaId" INTEGER NOT NULL
    REFERENCES control_financiero_cargas(id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  fecha DATE NOT NULL,
  "cierreId" INTEGER NULL
    REFERENCES cierre_caja(id)
    ON UPDATE CASCADE
    ON DELETE SET NULL,
  "cierreIds" JSONB NOT NULL DEFAULT '[]'::jsonb,
  origen VARCHAR(30) NOT NULL,
  resultados JSONB NOT NULL DEFAULT '[]'::jsonb,
  resumen JSONB NOT NULL DEFAULT '{}'::jsonb,
  "reglasManuales" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "ejecutadoPor" INTEGER NULL
    REFERENCES usuarios(id)
    ON UPDATE CASCADE
    ON DELETE SET NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

UPDATE control_financiero_conciliaciones_entradas
SET
  "cierreIds" = COALESCE("cierreIds", '[]'::jsonb),
  resultados = COALESCE(resultados, '[]'::jsonb),
  resumen = COALESCE(resumen, '{}'::jsonb),
  "reglasManuales" = COALESCE("reglasManuales", '[]'::jsonb)
WHERE
  "cierreIds" IS NULL
  OR resultados IS NULL
  OR resumen IS NULL
  OR "reglasManuales" IS NULL;

ALTER TABLE control_financiero_conciliaciones_entradas
  ALTER COLUMN "cierreIds" SET DEFAULT '[]'::jsonb,
  ALTER COLUMN "cierreIds" SET NOT NULL,
  ALTER COLUMN resultados SET DEFAULT '[]'::jsonb,
  ALTER COLUMN resultados SET NOT NULL,
  ALTER COLUMN resumen SET DEFAULT '{}'::jsonb,
  ALTER COLUMN resumen SET NOT NULL,
  ALTER COLUMN "reglasManuales" SET DEFAULT '[]'::jsonb,
  ALTER COLUMN "reglasManuales" SET NOT NULL;

CREATE INDEX IF NOT EXISTS control_financiero_conciliaciones_carga_fecha_idx
ON control_financiero_conciliaciones_entradas (
  "cargaId",
  fecha,
  "createdAt" DESC
);

CREATE INDEX IF NOT EXISTS control_financiero_conciliaciones_cierre_idx
ON control_financiero_conciliaciones_entradas ("cierreId");

CREATE UNIQUE INDEX IF NOT EXISTS
  control_financiero_conciliaciones_ejecucion_unique
ON control_financiero_conciliaciones_entradas ("ejecucionId");

SELECT
  to_regclass('public.control_financiero_conciliaciones_entradas')
    AS tabla_conciliaciones_despues,
  COUNT(*) AS ejecuciones_existentes
FROM control_financiero_conciliaciones_entradas;

COMMIT;
