-- 1. Verificación previa
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'agencias'
  AND column_name = 'tipo';

-- 2. Cambio seguro y compatible con registros existentes
ALTER TABLE public.agencias
  ADD COLUMN IF NOT EXISTS tipo VARCHAR(20);

UPDATE public.agencias
SET tipo = 'AGENCIA'
WHERE tipo IS NULL
   OR tipo NOT IN ('AGENCIA', 'DEPARTAMENTO');

ALTER TABLE public.agencias
  ALTER COLUMN tipo SET DEFAULT 'AGENCIA',
  ALTER COLUMN tipo SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'agencias_tipo_valido_chk'
      AND conrelid = 'public.agencias'::regclass
  ) THEN
    ALTER TABLE public.agencias
      ADD CONSTRAINT agencias_tipo_valido_chk
      CHECK (tipo IN ('AGENCIA', 'DEPARTAMENTO')) NOT VALID;
  END IF;
END $$;

ALTER TABLE public.agencias
  VALIDATE CONSTRAINT agencias_tipo_valido_chk;

-- 3. Validación final
SELECT tipo, COUNT(*) AS total
FROM public.agencias
GROUP BY tipo
ORDER BY tipo;
