-- Verificacion previa: confirma si el valor editable ya existe.
SELECT column_name, data_type, numeric_precision, numeric_scale, is_nullable
FROM information_schema.columns
WHERE table_name = 'pagos_comisiones_multas_ajustes'
  AND column_name = 'valorDescontar';

ALTER TABLE pagos_comisiones_multas_ajustes
ADD COLUMN IF NOT EXISTS "valorDescontar" DECIMAL(12, 2);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'pagos_comisiones_multas_valor_no_negativo'
  ) THEN
    ALTER TABLE pagos_comisiones_multas_ajustes
    ADD CONSTRAINT pagos_comisiones_multas_valor_no_negativo
    CHECK ("valorDescontar" IS NULL OR "valorDescontar" >= 0);
  END IF;
END $$;

-- Verificacion posterior: NULL conserva el calculo automatico de la sancion.
SELECT id, "usuarioId", "semanaInicio", omitida, "valorDescontar"
FROM pagos_comisiones_multas_ajustes
ORDER BY "semanaInicio" DESC, "usuarioId"
LIMIT 20;
