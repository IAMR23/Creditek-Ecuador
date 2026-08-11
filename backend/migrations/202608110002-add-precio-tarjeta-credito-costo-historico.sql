-- Verificacion previa: revisa la columna y los precios que serviran de respaldo.
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'costo_historicos'
  AND column_name = 'precioTarjetaCredito';

SELECT id, "modeloId", "fechaCompra", "precioContado"
FROM costo_historicos
WHERE "precioContado" IS NOT NULL
ORDER BY "fechaCompra" DESC, id DESC
LIMIT 20;

BEGIN;

ALTER TABLE costo_historicos
ADD COLUMN IF NOT EXISTS "precioTarjetaCredito" DECIMAL(10, 2);

-- Hasta que se defina un valor diferente, tarjeta conserva el PVP contado.
UPDATE costo_historicos
SET "precioTarjetaCredito" = "precioContado",
    "updatedAt" = NOW()
WHERE "precioTarjetaCredito" IS NULL
  AND "precioContado" IS NOT NULL;

COMMIT;

-- Verificacion posterior: no deben quedar respaldos pendientes.
SELECT COUNT(*) AS registros_pendientes
FROM costo_historicos
WHERE "precioContado" IS NOT NULL
  AND "precioTarjetaCredito" IS NULL;
