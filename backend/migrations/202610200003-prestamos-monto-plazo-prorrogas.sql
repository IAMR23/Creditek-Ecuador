-- Verificación previa.
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'egresos_creditek_entradas'
  AND column_name IN ('montoTotal', 'plazoMeses', 'prorrogas');

ALTER TABLE egresos_creditek_entradas
ADD COLUMN IF NOT EXISTS "montoTotal" DECIMAL(12, 2),
ADD COLUMN IF NOT EXISTS "plazoMeses" INTEGER,
ADD COLUMN IF NOT EXISTS prorrogas JSONB NOT NULL DEFAULT '[]'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'egresos_creditek_monto_total_positivo') THEN
    ALTER TABLE egresos_creditek_entradas ADD CONSTRAINT egresos_creditek_monto_total_positivo
    CHECK ("montoTotal" IS NULL OR "montoTotal" > 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'egresos_creditek_plazo_meses_rango') THEN
    ALTER TABLE egresos_creditek_entradas ADD CONSTRAINT egresos_creditek_plazo_meses_rango
    CHECK ("plazoMeses" IS NULL OR "plazoMeses" BETWEEN 1 AND 120);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'egresos_creditek_prorrogas_array') THEN
    ALTER TABLE egresos_creditek_entradas ADD CONSTRAINT egresos_creditek_prorrogas_array
    CHECK (jsonb_typeof(prorrogas) = 'array');
  END IF;
END $$;

-- Verificación posterior. Los préstamos históricos permanecen con monto/plazo NULL.
SELECT id, "montoTotal", "plazoMeses", prorrogas
FROM egresos_creditek_entradas
WHERE seccion = 'PRESTAMOS'
ORDER BY id DESC
LIMIT 20;
