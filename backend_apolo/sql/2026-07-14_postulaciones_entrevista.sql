-- Verificacion previa
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'postulaciones'
  AND column_name IN ('pasaEntrevista', 'pasaEntrevistaAt')
ORDER BY column_name;

BEGIN;

ALTER TABLE public.postulaciones
  ADD COLUMN IF NOT EXISTS "pasaEntrevista" BOOLEAN DEFAULT FALSE;

ALTER TABLE public.postulaciones
  ADD COLUMN IF NOT EXISTS "pasaEntrevistaAt" TIMESTAMP WITH TIME ZONE;

UPDATE public.postulaciones
SET "pasaEntrevista" = FALSE
WHERE "pasaEntrevista" IS NULL;

ALTER TABLE public.postulaciones
  ALTER COLUMN "pasaEntrevista" SET DEFAULT FALSE,
  ALTER COLUMN "pasaEntrevista" SET NOT NULL;

COMMIT;

-- Verificacion final
SELECT
  COUNT(*) AS total_postulaciones,
  COUNT(*) FILTER (WHERE "pasaEntrevista" = FALSE) AS en_postulacion,
  COUNT(*) FILTER (WHERE "pasaEntrevista" = TRUE) AS en_entrevista,
  COUNT(*) FILTER (WHERE "pasaEntrevista" IS NULL) AS estados_nulos
FROM public.postulaciones;
