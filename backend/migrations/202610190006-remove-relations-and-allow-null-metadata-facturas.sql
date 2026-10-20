-- Verificacion previa segura: lista nulabilidad y relaciones actuales.
SELECT column_name, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'facturas'
  AND column_name IN ('nombreArchivoJson', 'payloadOriginal', 'cargadoPorId')
ORDER BY column_name;

SELECT constraint_name, constraint_type
FROM information_schema.table_constraints
WHERE table_schema = 'public'
  AND table_name = 'facturas'
  AND constraint_type = 'FOREIGN KEY';

-- Conserva los datos y elimina solamente las relaciones de la tabla facturas.
DO $$
DECLARE
  relacion RECORD;
BEGIN
  IF to_regclass('public.facturas') IS NULL THEN
    RETURN;
  END IF;

  FOR relacion IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.facturas'::regclass
      AND contype = 'f'
  LOOP
    EXECUTE format(
      'ALTER TABLE public.facturas DROP CONSTRAINT %I',
      relacion.conname
    );
  END LOOP;
END $$;

ALTER TABLE IF EXISTS public.facturas
  ALTER COLUMN "nombreArchivoJson" DROP NOT NULL,
  ALTER COLUMN "payloadOriginal" DROP NOT NULL;

-- Una instalacion anterior puede conservar el identificador historico del
-- usuario que cargo el archivo. Se vuelve opcional, sin recrear relaciones.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'facturas'
      AND column_name = 'cargadoPorId'
  ) THEN
    ALTER TABLE public.facturas
      ALTER COLUMN "cargadoPorId" DROP NOT NULL;
  END IF;
END $$;

-- Validacion final: no deben existir claves foraneas y los campos deben ser NULL.
SELECT column_name, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'facturas'
  AND column_name IN ('nombreArchivoJson', 'payloadOriginal', 'cargadoPorId')
ORDER BY column_name;

SELECT constraint_name, constraint_type
FROM information_schema.table_constraints
WHERE table_schema = 'public'
  AND table_name = 'facturas'
  AND constraint_type = 'FOREIGN KEY';
