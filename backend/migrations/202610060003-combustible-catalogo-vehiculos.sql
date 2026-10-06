BEGIN;

SELECT vehiculo, COUNT(*) AS registros
FROM logistica_combustible_registros
GROUP BY vehiculo
ORDER BY vehiculo NULLS FIRST;

-- El nuevo catálogo se aplica a inserciones y actualizaciones. Se usa NOT VALID
-- para conservar registros históricos con NULL o descripciones anteriores.
ALTER TABLE logistica_combustible_registros
  DROP CONSTRAINT IF EXISTS logistica_combustible_vehiculo_chk;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'logistica_combustible_vehiculo_catalogo_chk'
      AND conrelid = 'logistica_combustible_registros'::regclass
  ) THEN
    ALTER TABLE logistica_combustible_registros
      ADD CONSTRAINT logistica_combustible_vehiculo_catalogo_chk CHECK (
        vehiculo IS NULL OR vehiculo IN (
          'MOTO ROJA', 'FURGONETA', 'CARRO HAVAL', 'MOTO AZUL'
        )
      ) NOT VALID;
  END IF;
END $$;

COMMIT;

SELECT conname, convalidated, pg_get_constraintdef(oid) AS definicion
FROM pg_constraint
WHERE conrelid = 'logistica_combustible_registros'::regclass
  AND conname = 'logistica_combustible_vehiculo_catalogo_chk';
