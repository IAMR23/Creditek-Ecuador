BEGIN;

ALTER TABLE IF EXISTS pagos_comisiones_promedios_supervisores
  ADD COLUMN IF NOT EXISTS "divisorPromedio" DECIMAL(10, 2);

DO $$
BEGIN
  IF to_regclass('pagos_comisiones_promedios_supervisores') IS NOT NULL THEN
    UPDATE pagos_comisiones_promedios_supervisores
    SET "divisorPromedio" = jsonb_array_length("vendedorIds")
    WHERE "divisorPromedio" IS NULL
      AND jsonb_typeof("vendedorIds") = 'array'
      AND jsonb_array_length("vendedorIds") > 0;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('pagos_comisiones_promedios_supervisores') IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'pagos_comisiones_promedios_supervisor_divisor_check'
        AND conrelid = 'pagos_comisiones_promedios_supervisores'::regclass
    ) THEN
    ALTER TABLE pagos_comisiones_promedios_supervisores
      ADD CONSTRAINT pagos_comisiones_promedios_supervisor_divisor_check
      CHECK ("divisorPromedio" IS NULL OR "divisorPromedio" > 0);
  END IF;
END $$;

COMMIT;
