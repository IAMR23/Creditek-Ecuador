-- Verificacion previa
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'postulaciones'
  AND column_name IN (
    'fechaEntrevista',
    'estadoEntrevista',
    'entrevistaDuracionMinutos',
    'entrevistadorId',
    'entrevistaModalidad',
    'entrevistaLugar',
    'entrevistaEnlace',
    'entrevistaObservaciones',
    'entrevistaReprogramaciones'
  )
ORDER BY column_name;

BEGIN;

ALTER TABLE public.postulaciones
  ADD COLUMN IF NOT EXISTS "fechaEntrevista" TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS "estadoEntrevista" VARCHAR(20) DEFAULT 'PENDIENTE',
  ADD COLUMN IF NOT EXISTS "entrevistaDuracionMinutos" INTEGER,
  ADD COLUMN IF NOT EXISTS "entrevistadorId" INTEGER,
  ADD COLUMN IF NOT EXISTS "entrevistaModalidad" VARCHAR(15),
  ADD COLUMN IF NOT EXISTS "entrevistaLugar" TEXT,
  ADD COLUMN IF NOT EXISTS "entrevistaEnlace" TEXT,
  ADD COLUMN IF NOT EXISTS "entrevistaObservaciones" TEXT,
  ADD COLUMN IF NOT EXISTS "entrevistaReprogramaciones" INTEGER DEFAULT 0;

UPDATE public.postulaciones
SET "estadoEntrevista" = CASE
      WHEN "fechaEntrevista" IS NOT NULL THEN 'AGENDADA'
      ELSE 'PENDIENTE'
    END
WHERE "estadoEntrevista" IS NULL;

UPDATE public.postulaciones
SET "estadoEntrevista" = 'AGENDADA'
WHERE "fechaEntrevista" IS NOT NULL
  AND "estadoEntrevista" = 'PENDIENTE';

UPDATE public.postulaciones
SET "entrevistaReprogramaciones" = 0
WHERE "entrevistaReprogramaciones" IS NULL;

ALTER TABLE public.postulaciones
  ALTER COLUMN "estadoEntrevista" SET DEFAULT 'PENDIENTE',
  ALTER COLUMN "estadoEntrevista" SET NOT NULL,
  ALTER COLUMN "entrevistaReprogramaciones" SET DEFAULT 0,
  ALTER COLUMN "entrevistaReprogramaciones" SET NOT NULL;

COMMIT;

-- Verificacion final
SELECT
  "estadoEntrevista",
  COUNT(*) AS total
FROM public.postulaciones
WHERE "pasaEntrevista" = TRUE
GROUP BY "estadoEntrevista"
ORDER BY "estadoEntrevista";
