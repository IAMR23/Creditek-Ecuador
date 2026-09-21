-- Verificacion previa: muestra si la columna ya existe y su valor actual.
SELECT column_name, data_type, character_maximum_length
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'ghl_reparto_tiempo_real_configuraciones'
  AND column_name = 'horaPausaAutomatica';

BEGIN;

ALTER TABLE ghl_reparto_tiempo_real_configuraciones
  ADD COLUMN IF NOT EXISTS "horaPausaAutomatica" VARCHAR(5);

UPDATE ghl_reparto_tiempo_real_configuraciones
SET "horaPausaAutomatica" = '18:00'
WHERE "horaPausaAutomatica" IS NULL
   OR "horaPausaAutomatica" !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$';

ALTER TABLE ghl_reparto_tiempo_real_configuraciones
  ALTER COLUMN "horaPausaAutomatica" SET DEFAULT '18:00',
  ALTER COLUMN "horaPausaAutomatica" SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ghl_reparto_tiempo_real_hora_pausa_check'
      AND conrelid = 'ghl_reparto_tiempo_real_configuraciones'::regclass
  ) THEN
    ALTER TABLE ghl_reparto_tiempo_real_configuraciones
      ADD CONSTRAINT ghl_reparto_tiempo_real_hora_pausa_check
      CHECK ("horaPausaAutomatica" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');
  END IF;
END $$;

COMMIT;

-- Verificacion posterior: debe devolver una sola fila con formato HH:mm.
SELECT id, "horaPausaAutomatica", "actualizadoPorId", "updatedAt"
FROM ghl_reparto_tiempo_real_configuraciones
WHERE id = 1;
