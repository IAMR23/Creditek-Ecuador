-- Verificacion previa de la columna usada por la seleccion manual mensual.
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'pagos_comisiones_sanciones_observaciones'
  AND column_name = 'personalNuevoBonoVendedores';

BEGIN;

ALTER TABLE IF EXISTS pagos_comisiones_sanciones_observaciones
  ADD COLUMN IF NOT EXISTS "personalNuevoBonoVendedores" JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMIT;

-- Verificacion final: debe devolver una fila JSONB no nula.
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'pagos_comisiones_sanciones_observaciones'
  AND column_name = 'personalNuevoBonoVendedores';
