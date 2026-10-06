BEGIN;

SELECT column_name, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'logistica_combustible_registros'
  AND column_name IN ('vehiculo', 'combustibleConsumido');

-- Conserva filas y consumos históricos; los nuevos registros no necesitan litros.
ALTER TABLE logistica_combustible_registros
  ADD COLUMN IF NOT EXISTS vehiculo VARCHAR(150);
ALTER TABLE logistica_combustible_registros
  ALTER COLUMN "combustibleConsumido" DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname IN (
      'logistica_combustible_vehiculo_chk',
      'logistica_combustible_vehiculo_catalogo_chk'
    )
      AND conrelid = 'logistica_combustible_registros'::regclass
  ) THEN
    -- Sustituye únicamente el CHECK de la versión anterior, dentro de la transacción.
    -- Se conserva su nombre para que la migración inicial siga siendo repetible.
    ALTER TABLE logistica_combustible_registros
      DROP CONSTRAINT IF EXISTS logistica_combustible_valores_chk;
    ALTER TABLE logistica_combustible_registros
      ADD CONSTRAINT logistica_combustible_valores_chk CHECK (
        fecha >= DATE '1900-01-01' AND fecha <= DATE '9999-12-31'
        AND "kilometrajeInicial" >= 0
        AND "kilometrajeFinal" >= "kilometrajeInicial"
        AND "kilometrosRecorridos" = "kilometrajeFinal" - "kilometrajeInicial"
        AND "costoCombustible" >= 0 AND "costoCombustible" < 100000000
        AND "kilometrajeInicial" < 100000000 AND "kilometrajeFinal" < 100000000
        AND ("combustibleConsumido" IS NULL OR
          ("combustibleConsumido" >= 0 AND "combustibleConsumido" < 100000000))
      );
    -- Los registros históricos sin vehículo quedan en NULL y se muestran como no registrados.
    ALTER TABLE logistica_combustible_registros
      ADD CONSTRAINT logistica_combustible_vehiculo_chk CHECK (
        vehiculo IS NULL OR (NULLIF(BTRIM(vehiculo), '') IS NOT NULL
          AND CHAR_LENGTH(vehiculo) <= 150 AND vehiculo !~ '[[:cntrl:]]')
      );
  END IF;
END $$;

COMMIT;

SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'logistica_combustible_registros'
  AND column_name IN ('vehiculo', 'combustibleConsumido');
SELECT conname FROM pg_constraint
WHERE conrelid = 'logistica_combustible_registros'::regclass
  AND conname IN ('logistica_combustible_valores_chk', 'logistica_combustible_vehiculo_chk');
