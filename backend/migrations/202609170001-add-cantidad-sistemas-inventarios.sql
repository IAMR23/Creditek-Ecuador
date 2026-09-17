-- Verificacion previa: confirma si la columna ya existe.
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'sistemas_inventarios'
  AND column_name = 'cantidad';

BEGIN;

ALTER TABLE IF EXISTS sistemas_inventarios
  ADD COLUMN IF NOT EXISTS cantidad INTEGER NOT NULL DEFAULT 1;

DO $$
BEGIN
  IF to_regclass('public.sistemas_inventarios') IS NOT NULL THEN
    UPDATE sistemas_inventarios
    SET cantidad = 1
    WHERE cantidad IS NULL OR cantidad < 1;

    ALTER TABLE sistemas_inventarios
      ALTER COLUMN cantidad SET DEFAULT 1,
      ALTER COLUMN cantidad SET NOT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.sistemas_inventarios') IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'sistemas_inventarios_cantidad_positiva'
        AND conrelid = to_regclass('public.sistemas_inventarios')
    )
  THEN
    ALTER TABLE sistemas_inventarios
      ADD CONSTRAINT sistemas_inventarios_cantidad_positiva
      CHECK (cantidad >= 1) NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.sistemas_inventarios') IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'sistemas_inventarios_cantidad_positiva'
        AND conrelid = to_regclass('public.sistemas_inventarios')
    )
  THEN
    ALTER TABLE sistemas_inventarios
      VALIDATE CONSTRAINT sistemas_inventarios_cantidad_positiva;
  END IF;
END $$;

COMMIT;

-- Verificacion posterior: los historicos quedan en uno y no existen cantidades invalidas.
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'sistemas_inventarios'
  AND column_name = 'cantidad';

SELECT COUNT(*) AS cantidades_invalidas
FROM sistemas_inventarios
WHERE cantidad IS NULL OR cantidad < 1;
