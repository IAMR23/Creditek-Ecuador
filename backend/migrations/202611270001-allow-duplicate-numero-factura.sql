-- Verificacion previa: muestra el indice unico que impide guardar duplicados.
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'facturas'
  AND indexname = 'facturas_numero_factura_unique';

-- Este cambio no elimina ni modifica facturas existentes.
DROP INDEX IF EXISTS public.facturas_numero_factura_unique;

-- Conserva el rendimiento de las busquedas sin exigir valores unicos.
CREATE INDEX IF NOT EXISTS facturas_numero_factura_idx
  ON public.facturas ("numeroFactura");

-- Validacion final: unique_index debe ser false.
SELECT indexname,
       indexdef,
       indexdef ILIKE 'CREATE UNIQUE INDEX%' AS unique_index
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'facturas'
  AND indexname = 'facturas_numero_factura_idx';
