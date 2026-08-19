-- Migracion aditiva para conservar la precision original del precio unitario
-- y atributos variables de las lineas OCR. No modifica los valores existentes.

SELECT
  COUNT(*) AS productos_antes,
  COUNT("precioUnitario") AS precios_legacy_antes
FROM facturas_fisicas_productos_ocr;

ALTER TABLE facturas_fisicas_productos_ocr
  ADD COLUMN IF NOT EXISTS "precioUnitarioExacto" NUMERIC(18, 6),
  ADD COLUMN IF NOT EXISTS "datosAdicionales" JSONB;

COMMENT ON COLUMN facturas_fisicas_productos_ocr."precioUnitarioExacto" IS
  'Precio unitario OCR con precision de hasta seis decimales; precioUnitario se conserva por compatibilidad.';

COMMENT ON COLUMN facturas_fisicas_productos_ocr."datosAdicionales" IS
  'Atributos variables detectados por OCR para la linea de producto.';

SELECT
  COUNT(*) AS productos_despues,
  COUNT("precioUnitario") AS precios_legacy_despues,
  COUNT("precioUnitarioExacto") AS precios_exactos_despues
FROM facturas_fisicas_productos_ocr;
