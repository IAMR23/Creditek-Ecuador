-- Verificacion previa
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'postulaciones'
  AND column_name IN ('descartada', 'descartadaAt')
ORDER BY column_name;

BEGIN;

ALTER TABLE public.postulaciones
  ADD COLUMN IF NOT EXISTS "descartada" BOOLEAN DEFAULT FALSE;

ALTER TABLE public.postulaciones
  ADD COLUMN IF NOT EXISTS "descartadaAt" TIMESTAMP WITH TIME ZONE;

UPDATE public.postulaciones
SET "descartada" = FALSE
WHERE "descartada" IS NULL;

ALTER TABLE public.postulaciones
  ALTER COLUMN "descartada" SET DEFAULT FALSE,
  ALTER COLUMN "descartada" SET NOT NULL;

COMMIT;

-- Verificacion final
SELECT
  COUNT(*) AS total_postulaciones,
  COUNT(*) FILTER (WHERE "descartada" = FALSE) AS activas,
  COUNT(*) FILTER (WHERE "descartada" = TRUE) AS descartadas,
  COUNT(*) FILTER (WHERE "descartada" IS NULL) AS estados_nulos
FROM public.postulaciones;
