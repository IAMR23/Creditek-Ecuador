-- Verificacion previa: la consulta no debe devolver filas antes del cambio.
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'entregas'
  AND column_name = 'tipoEntrega';

-- Cambio incremental: conserva los registros historicos como entregas.
ALTER TABLE entregas
  ADD COLUMN IF NOT EXISTS "tipoEntrega" VARCHAR(20);

UPDATE entregas
SET "tipoEntrega" = 'Entrega'
WHERE "tipoEntrega" IS NULL;

ALTER TABLE entregas
  ALTER COLUMN "tipoEntrega" SET DEFAULT 'Entrega',
  ALTER COLUMN "tipoEntrega" SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'entregas_tipo_entrega_check'
      AND conrelid = 'entregas'::regclass
  ) THEN
    ALTER TABLE entregas
      ADD CONSTRAINT entregas_tipo_entrega_check
      CHECK ("tipoEntrega" IN ('Entrega', 'Envio'));
  END IF;
END $$;

-- Verificacion posterior: debe mostrar solo Entrega o Envio y cero nulos.
SELECT "tipoEntrega", COUNT(*) AS total
FROM entregas
GROUP BY "tipoEntrega"
ORDER BY "tipoEntrega";

SELECT COUNT(*) AS registros_sin_tipo
FROM entregas
WHERE "tipoEntrega" IS NULL;
