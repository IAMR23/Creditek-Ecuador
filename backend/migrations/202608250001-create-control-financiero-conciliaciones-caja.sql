BEGIN;

SELECT
  to_regclass('public.control_financiero_conciliaciones_caja')
    AS tabla_conciliaciones_caja_antes;

CREATE TABLE IF NOT EXISTS control_financiero_conciliaciones_caja (
  id BIGSERIAL PRIMARY KEY,
  "ejecucionId" UUID NOT NULL,
  "cargaId" INTEGER NOT NULL
    REFERENCES control_financiero_cargas(id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  "fechaReporte" DATE NULL,
  fechas JSONB NOT NULL DEFAULT '[]'::jsonb,
  "cierreIds" JSONB NOT NULL DEFAULT '[]'::jsonb,
  origen VARCHAR(30) NOT NULL,
  resultados JSONB NOT NULL DEFAULT '[]'::jsonb,
  resumen JSONB NOT NULL DEFAULT '{}'::jsonb,
  "ejecutadoPor" INTEGER NULL
    REFERENCES usuarios(id)
    ON UPDATE CASCADE
    ON DELETE SET NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS control_financiero_conciliaciones_caja_carga_idx
ON control_financiero_conciliaciones_caja ("cargaId", "createdAt" DESC);

CREATE UNIQUE INDEX IF NOT EXISTS
  control_financiero_conciliaciones_caja_ejecucion_unique
ON control_financiero_conciliaciones_caja ("ejecucionId");

SELECT
  to_regclass('public.control_financiero_conciliaciones_caja')
    AS tabla_conciliaciones_caja_despues,
  COUNT(*) AS ejecuciones_existentes
FROM control_financiero_conciliaciones_caja;

COMMIT;
