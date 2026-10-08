BEGIN;

-- Verificación previa: confirma si la columna ya existe.
SELECT column_name, data_type, numeric_precision, numeric_scale
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'pagos_comisiones_promedios_jefes'
  AND column_name = 'metaVentas';

ALTER TABLE pagos_comisiones_promedios_jefes
ADD COLUMN IF NOT EXISTS "metaVentas" DECIMAL(12, 2);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'pagos_comisiones_meta_jefe_positiva_check'
  ) THEN
    ALTER TABLE pagos_comisiones_promedios_jefes
    ADD CONSTRAINT pagos_comisiones_meta_jefe_positiva_check
    CHECK ("metaVentas" IS NULL OR "metaVentas" > 0);
  END IF;
END $$;

-- Verificación final: lista las metas mensuales configuradas.
SELECT id, "jefeComercialId", anio, mes, "metaVentas"
FROM pagos_comisiones_promedios_jefes
WHERE "metaVentas" IS NOT NULL
ORDER BY anio DESC, mes DESC, "jefeComercialId";

COMMIT;
