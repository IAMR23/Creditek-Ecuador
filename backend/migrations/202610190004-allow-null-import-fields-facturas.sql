-- Verificacion previa segura:
SELECT column_name, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'facturas'
  AND column_name IN ('proveedor', 'numeroFactura', 'subtotal', 'iva', 'formaPago')
ORDER BY column_name;

ALTER TABLE IF EXISTS public.facturas
  ALTER COLUMN proveedor DROP NOT NULL,
  ALTER COLUMN "numeroFactura" DROP NOT NULL,
  ALTER COLUMN subtotal DROP NOT NULL,
  ALTER COLUMN iva DROP NOT NULL,
  ALTER COLUMN "formaPago" DROP NOT NULL;

-- Validacion final:
SELECT column_name, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'facturas'
  AND column_name IN ('proveedor', 'numeroFactura', 'subtotal', 'iva', 'formaPago')
ORDER BY column_name;
