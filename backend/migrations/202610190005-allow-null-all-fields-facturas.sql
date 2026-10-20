-- Verificacion previa segura:
SELECT column_name, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'facturas'
  AND column_name IN ('fechaFactura', 'total', 'estado', 'tipo')
ORDER BY column_name;

ALTER TABLE IF EXISTS public.facturas
  ALTER COLUMN "fechaFactura" DROP NOT NULL,
  ALTER COLUMN total DROP NOT NULL,
  ALTER COLUMN estado DROP NOT NULL,
  ALTER COLUMN tipo DROP NOT NULL;

-- Validacion final:
SELECT column_name, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'facturas'
  AND column_name IN ('fechaFactura', 'total', 'estado', 'tipo')
ORDER BY column_name;
