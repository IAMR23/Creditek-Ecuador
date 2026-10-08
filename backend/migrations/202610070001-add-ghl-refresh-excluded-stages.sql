-- Verificacion previa: las columnas pueden no existir en instalaciones anteriores.
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'ghl_reparto_configuraciones'
  AND column_name IN ('stageId', 'stageNombre', 'stageIds', 'stageNombres')
ORDER BY column_name;

BEGIN;

ALTER TABLE ghl_reparto_configuraciones
  ADD COLUMN IF NOT EXISTS "stageIds" VARCHAR(100)[],
  ADD COLUMN IF NOT EXISTS "stageNombres" VARCHAR(200)[];

-- Conserva todas las configuraciones existentes usando su etapa actual.
UPDATE ghl_reparto_configuraciones
SET "stageIds" = ARRAY["stageId"]::VARCHAR(100)[],
    "stageNombres" = ARRAY["stageNombre"]::VARCHAR(200)[]
WHERE "stageIds" IS NULL OR cardinality("stageIds") = 0
   OR "stageNombres" IS NULL OR cardinality("stageNombres") = 0;

ALTER TABLE ghl_reparto_configuraciones
  ALTER COLUMN "stageIds" SET DEFAULT ARRAY[]::VARCHAR(100)[],
  ALTER COLUMN "stageIds" SET NOT NULL,
  ALTER COLUMN "stageNombres" SET DEFAULT ARRAY[]::VARCHAR(200)[],
  ALTER COLUMN "stageNombres" SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ghl_reparto_config_stage_arrays_check'
      AND conrelid = 'ghl_reparto_configuraciones'::regclass
  ) THEN
    ALTER TABLE ghl_reparto_configuraciones
      ADD CONSTRAINT ghl_reparto_config_stage_arrays_check
      CHECK (
        cardinality("stageIds") > 0
        AND cardinality("stageIds") = cardinality("stageNombres")
      );
  END IF;
END $$;

COMMIT;

-- Verificacion final: no debe devolver filas.
SELECT id, "stageId", "stageNombre", "stageIds", "stageNombres"
FROM ghl_reparto_configuraciones
WHERE cardinality("stageIds") = 0
   OR cardinality("stageIds") <> cardinality("stageNombres");

SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'ghl_reparto_configuraciones'
  AND column_name IN ('stageIds', 'stageNombres')
ORDER BY column_name;
