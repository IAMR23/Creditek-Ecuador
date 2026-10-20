-- Verificacion previa: esta consulta debe devolver cero filas.
-- Si devuelve resultados, corregir los duplicados manualmente antes de
-- continuar. Esta migracion no elimina ni modifica facturas existentes.
SELECT "numeroFactura", COUNT(*) AS cantidad
FROM facturas
WHERE "numeroFactura" IS NOT NULL
GROUP BY "numeroFactura"
HAVING COUNT(*) > 1
ORDER BY cantidad DESC, "numeroFactura";

-- La creacion falla de forma segura si aun existen numeros duplicados.
CREATE UNIQUE INDEX IF NOT EXISTS facturas_numero_factura_unique
  ON facturas ("numeroFactura");

-- Validacion final:
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'facturas'
  AND indexname = 'facturas_numero_factura_unique';
