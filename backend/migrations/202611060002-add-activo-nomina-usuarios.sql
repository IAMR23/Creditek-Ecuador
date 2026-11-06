BEGIN;

-- Verificacion previa: confirma si el indicador ya existe.
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'usuarios'
  AND column_name = 'activoNomina';

ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS "activoNomina" BOOLEAN
    NOT NULL DEFAULT TRUE;

-- Compatibilidad con instalaciones donde la columna exista parcialmente.
UPDATE public.usuarios
SET "activoNomina" = TRUE
WHERE "activoNomina" IS NULL;

ALTER TABLE public.usuarios
  ALTER COLUMN "activoNomina" SET DEFAULT TRUE,
  ALTER COLUMN "activoNomina" SET NOT NULL;

-- Verificacion final: los usuarios actuales permanecen incluidos por defecto.
SELECT "activoNomina", COUNT(*) AS total
FROM public.usuarios
GROUP BY "activoNomina"
ORDER BY "activoNomina";

COMMIT;
