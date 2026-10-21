-- Verificacion previa: la ausencia de filas indica que la columna aun no existe.
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'roles_creditek_ajustes'
  AND column_name = 'diasFalta';

ALTER TABLE roles_creditek_ajustes
ADD COLUMN IF NOT EXISTS "diasFalta" INTEGER NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'roles_creditek_ajustes_dias_falta_rango'
  ) THEN
    ALTER TABLE roles_creditek_ajustes
    ADD CONSTRAINT roles_creditek_ajustes_dias_falta_rango
    CHECK ("diasFalta" BETWEEN 0 AND 30);
  END IF;
END $$;

-- Verificacion posterior: todos los valores deben estar en el rango permitido.
SELECT COUNT(*) AS registros_fuera_de_rango
FROM roles_creditek_ajustes
WHERE "diasFalta" NOT BETWEEN 0 AND 30;
