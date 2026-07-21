-- Verificacion previa: confirma si la columna ya existe.
SELECT column_name, data_type, numeric_precision, numeric_scale, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'sistemas_inventarios'
  AND column_name = 'precio';

BEGIN;

ALTER TABLE IF EXISTS sistemas_inventarios
  ADD COLUMN IF NOT EXISTS precio NUMERIC(12, 2);

DO $$
BEGIN
  IF to_regclass('public.sistemas_inventarios') IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'sistemas_inventarios_precio_no_negativo'
        AND conrelid = to_regclass('public.sistemas_inventarios')
    )
  THEN
    ALTER TABLE sistemas_inventarios
      ADD CONSTRAINT sistemas_inventarios_precio_no_negativo
      CHECK (precio IS NULL OR precio >= 0) NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.sistemas_inventarios') IS NOT NULL THEN
    ALTER TABLE sistemas_inventarios
      VALIDATE CONSTRAINT sistemas_inventarios_precio_no_negativo;
  END IF;
END $$;

COMMIT;

-- Verificacion posterior: la columna debe ser NUMERIC(12,2) y nullable.
SELECT column_name, data_type, numeric_precision, numeric_scale, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'sistemas_inventarios'
  AND column_name = 'precio';
