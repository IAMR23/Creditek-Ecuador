-- Verificacion previa segura:
SELECT column_name, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'facturas'
  AND column_name = 'identificacionProveedor';

ALTER TABLE IF EXISTS public.facturas
  ALTER COLUMN "identificacionProveedor" DROP NOT NULL;

-- Validacion final:
SELECT column_name, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'facturas'
  AND column_name = 'identificacionProveedor';
