SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'pagos_comisiones_sanciones_observaciones';

BEGIN;
ALTER TABLE pagos_comisiones_sanciones_observaciones
ADD COLUMN IF NOT EXISTS "observacionesVendedores" JSONB NOT NULL DEFAULT '{}'::jsonb;
COMMIT;

SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'pagos_comisiones_sanciones_observaciones'
AND column_name = 'observacionesVendedores';
