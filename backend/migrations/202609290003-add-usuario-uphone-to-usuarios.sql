-- Verificacion previa
SELECT column_name, data_type, character_maximum_length, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'usuarios'
  AND column_name = 'usuarioUphone';

ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS "usuarioUphone" VARCHAR(100) NULL;

-- Verifica posibles duplicados antes de crear la restriccion uno a uno.
SELECT LOWER(BTRIM("usuarioUphone")) AS usuario_uphone, COUNT(*) AS total
FROM public.usuarios
WHERE NULLIF(BTRIM("usuarioUphone"), '') IS NOT NULL
GROUP BY LOWER(BTRIM("usuarioUphone"))
HAVING COUNT(*) > 1;

CREATE UNIQUE INDEX IF NOT EXISTS usuarios_usuario_uphone_lower_unique
  ON public.usuarios (LOWER(BTRIM("usuarioUphone")))
  WHERE NULLIF(BTRIM("usuarioUphone"), '') IS NOT NULL;

-- Verificacion final
SELECT column_name, data_type, character_maximum_length, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'usuarios'
  AND column_name = 'usuarioUphone';

SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'usuarios'
  AND indexname = 'usuarios_usuario_uphone_lower_unique';
