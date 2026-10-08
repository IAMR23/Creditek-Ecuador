BEGIN;

-- Verificacion previa: muestra si los campos laborales ya existen.
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'usuarios'
  AND column_name IN ('jornadaLaboral', 'afiliadoIess')
ORDER BY column_name;

ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS "jornadaLaboral" VARCHAR(20)
    NOT NULL DEFAULT 'tiempo_completo',
  ADD COLUMN IF NOT EXISTS "afiliadoIess" BOOLEAN
    NOT NULL DEFAULT TRUE;

-- Compatibilidad con instalaciones donde una columna haya sido creada
-- parcialmente: solo completa valores vacios y no pisa cambios posteriores.
UPDATE public.usuarios
SET "jornadaLaboral" = 'tiempo_completo'
WHERE "jornadaLaboral" IS NULL;

UPDATE public.usuarios
SET "afiliadoIess" = TRUE
WHERE "afiliadoIess" IS NULL;

ALTER TABLE public.usuarios
  ALTER COLUMN "jornadaLaboral" SET DEFAULT 'tiempo_completo',
  ALTER COLUMN "jornadaLaboral" SET NOT NULL,
  ALTER COLUMN "afiliadoIess" SET DEFAULT TRUE,
  ALTER COLUMN "afiliadoIess" SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'usuarios_jornada_laboral_check'
      AND conrelid = 'public.usuarios'::regclass
  ) THEN
    ALTER TABLE public.usuarios
      ADD CONSTRAINT usuarios_jornada_laboral_check
      CHECK ("jornadaLaboral" IN ('tiempo_completo', 'medio_tiempo'));
  END IF;
END $$;

-- Verificacion final: todos los usuarios existentes deben quedar afiliados
-- y con jornada de tiempo completo en la primera ejecucion.
SELECT "jornadaLaboral", "afiliadoIess", COUNT(*) AS total
FROM public.usuarios
GROUP BY "jornadaLaboral", "afiliadoIess"
ORDER BY "jornadaLaboral", "afiliadoIess";

COMMIT;
