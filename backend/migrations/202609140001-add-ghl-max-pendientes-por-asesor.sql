-- Verificacion previa: la columna debe ser inexistente o conservar valores validos.
SELECT column_name, column_default, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'ghl_reparto_configuraciones'
  AND column_name = 'maxPendientesPorAsesor';

BEGIN;

ALTER TABLE ghl_reparto_configuraciones
  ADD COLUMN IF NOT EXISTS "maxPendientesPorAsesor" INTEGER;

ALTER TABLE ghl_reparto_configuraciones
  ALTER COLUMN "maxPendientesPorAsesor" SET DEFAULT 10;

UPDATE ghl_reparto_configuraciones
SET "maxPendientesPorAsesor" = 10
WHERE "maxPendientesPorAsesor" IS NULL
   OR "maxPendientesPorAsesor" NOT BETWEEN 1 AND 1000;

ALTER TABLE ghl_reparto_configuraciones
  ALTER COLUMN "maxPendientesPorAsesor" SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ghl_reparto_config_max_pendientes_check'
      AND conrelid = 'ghl_reparto_configuraciones'::regclass
  ) THEN
    ALTER TABLE ghl_reparto_configuraciones
      ADD CONSTRAINT ghl_reparto_config_max_pendientes_check
      CHECK ("maxPendientesPorAsesor" BETWEEN 1 AND 1000);
  END IF;
END $$;

ALTER TABLE ghl_reparto_ejecuciones
  ADD COLUMN IF NOT EXISTS "totalPlanificadas" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "totalOmitidasCambioEtapa" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "totalOmitidasAsesorPausado" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "totalOmitidasPropietarioCambiado" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "totalPendientesCapacidad" INTEGER NOT NULL DEFAULT 0;

-- Las ejecuciones previas a esta migracion planificaban todas las elegibles.
UPDATE ghl_reparto_ejecuciones
SET "totalPlanificadas" = "totalElegibles"
WHERE "totalPlanificadas" = 0
  AND "totalElegibles" > 0;

COMMIT;

-- Verificacion posterior: todas las configuraciones deben tener un limite valido.
SELECT id, "maxPendientesPorAsesor"
FROM ghl_reparto_configuraciones
WHERE "maxPendientesPorAsesor" IS NULL
   OR "maxPendientesPorAsesor" NOT BETWEEN 1 AND 1000;

SELECT column_name, column_default, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('ghl_reparto_configuraciones', 'ghl_reparto_ejecuciones')
  AND column_name IN (
    'maxPendientesPorAsesor',
    'totalPlanificadas',
    'totalOmitidasCambioEtapa',
    'totalOmitidasAsesorPausado',
    'totalOmitidasPropietarioCambiado',
    'totalPendientesCapacidad'
  )
ORDER BY table_name, column_name;
