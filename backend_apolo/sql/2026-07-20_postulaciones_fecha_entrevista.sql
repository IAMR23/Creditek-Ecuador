-- Verificacion previa
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'postulaciones'
  AND column_name = 'fechaEntrevista';

BEGIN;

ALTER TABLE public.postulaciones
  ADD COLUMN IF NOT EXISTS "fechaEntrevista" TIMESTAMP WITH TIME ZONE;

COMMIT;

-- Verificacion final
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'postulaciones'
  AND column_name = 'fechaEntrevista';

SELECT id, nombre, "pasaEntrevista", "fechaEntrevista"
FROM public.postulaciones
WHERE "pasaEntrevista" = TRUE
ORDER BY id DESC;
