-- Verificacion previa: la ausencia de filas indica que la columna aun no existe.
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'usuarios'
  AND column_name = 'metaMinimaSemanal';

ALTER TABLE usuarios
ADD COLUMN IF NOT EXISTS "metaMinimaSemanal" INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'usuarios_meta_minima_semanal_no_negativa'
  ) THEN
    ALTER TABLE usuarios
    ADD CONSTRAINT usuarios_meta_minima_semanal_no_negativa
    CHECK ("metaMinimaSemanal" IS NULL OR "metaMinimaSemanal" >= 0);
  END IF;
END $$;

-- Verificacion posterior: NULL usa como respaldo la meta configurada por rol.
SELECT id, nombre, "metaMinimaSemanal"
FROM usuarios
WHERE "metaMinimaSemanal" IS NOT NULL
ORDER BY nombre;
