-- Configuracion semanal de flujo GHL. Es aditiva y conserva el comportamiento actual.
ALTER TABLE IF EXISTS ghl_reparto_tiempo_real_configuraciones
  ADD COLUMN IF NOT EXISTS "horaInicioPlay" VARCHAR(5) NOT NULL DEFAULT '00:00',
  ADD COLUMN IF NOT EXISTS "horaPausaAutomatica" VARCHAR(5) NOT NULL DEFAULT '18:00',
  ADD COLUMN IF NOT EXISTS "horariosFlujoActivo" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "horariosFlujo" JSONB NOT NULL DEFAULT '[]'::jsonb;

UPDATE ghl_reparto_tiempo_real_configuraciones
SET "horaInicioPlay" = '00:00'
WHERE "horaInicioPlay" IS NULL
   OR "horaInicioPlay" !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$';

UPDATE ghl_reparto_tiempo_real_configuraciones
SET "horaPausaAutomatica" = '18:00'
WHERE "horaPausaAutomatica" IS NULL
   OR "horaPausaAutomatica" !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$';

ALTER TABLE ghl_reparto_tiempo_real_configuraciones
  ALTER COLUMN "horaInicioPlay" SET DEFAULT '00:00',
  ALTER COLUMN "horaInicioPlay" SET NOT NULL,
  ALTER COLUMN "horaPausaAutomatica" SET DEFAULT '18:00',
  ALTER COLUMN "horaPausaAutomatica" SET NOT NULL;

SELECT
  id,
  "horaInicioPlay",
  "horaPausaAutomatica",
  "horariosFlujoActivo",
  jsonb_array_length("horariosFlujo") AS bloques_configurados
FROM ghl_reparto_tiempo_real_configuraciones
ORDER BY id;
