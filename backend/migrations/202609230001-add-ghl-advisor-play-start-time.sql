-- Verificacion previa: muestra si la hora de inicio ya existe.
SELECT column_name, data_type, character_maximum_length
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'ghl_reparto_tiempo_real_configuraciones'
  AND column_name = 'horaInicioPlay';

BEGIN;

ALTER TABLE ghl_reparto_tiempo_real_configuraciones
  ADD COLUMN IF NOT EXISTS "horaInicioPlay" VARCHAR(5);

-- 00:00 conserva el comportamiento previo hasta que Gerencia configure la hora real.
UPDATE ghl_reparto_tiempo_real_configuraciones
SET "horaInicioPlay" = '00:00'
WHERE "horaInicioPlay" IS NULL
   OR "horaInicioPlay" !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$';

ALTER TABLE ghl_reparto_tiempo_real_configuraciones
  ALTER COLUMN "horaInicioPlay" SET DEFAULT '00:00',
  ALTER COLUMN "horaInicioPlay" SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ghl_reparto_tiempo_real_hora_inicio_play_check'
      AND conrelid = 'ghl_reparto_tiempo_real_configuraciones'::regclass
  ) THEN
    ALTER TABLE ghl_reparto_tiempo_real_configuraciones
      ADD CONSTRAINT ghl_reparto_tiempo_real_hora_inicio_play_check
      CHECK ("horaInicioPlay" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');
  END IF;
END $$;

COMMIT;

-- Verificacion posterior: inicio y cierre deben tener formato HH:mm.
SELECT id, "horaInicioPlay", "horaPausaAutomatica", "actualizadoPorId", "updatedAt"
FROM ghl_reparto_tiempo_real_configuraciones
WHERE id = 1;

