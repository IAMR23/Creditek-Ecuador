-- Nivel ponderado por asesor para el reparto automatico GHL (1 = menor flujo, 5 = mayor flujo).
ALTER TABLE IF EXISTS ghl_reparto_tiempo_real_configuraciones
  ADD COLUMN IF NOT EXISTS "nivelesFlujo" JSONB NOT NULL DEFAULT '{}'::jsonb;

UPDATE ghl_reparto_tiempo_real_configuraciones
SET "nivelesFlujo" = '{}'::jsonb
WHERE "nivelesFlujo" IS NULL
   OR jsonb_typeof("nivelesFlujo") <> 'object';

ALTER TABLE ghl_reparto_tiempo_real_configuraciones
  ALTER COLUMN "nivelesFlujo" SET DEFAULT '{}'::jsonb,
  ALTER COLUMN "nivelesFlujo" SET NOT NULL;

SELECT id, "nivelesFlujo"
FROM ghl_reparto_tiempo_real_configuraciones
ORDER BY id;
