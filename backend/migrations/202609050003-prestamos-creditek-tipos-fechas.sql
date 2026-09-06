SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'egresos_creditek_entradas';
BEGIN;
ALTER TABLE egresos_creditek_entradas ADD COLUMN IF NOT EXISTS "fechaFin" DATE;
-- Reemplaza solamente la validacion de tipos; conserva registros y tipos historicos.
ALTER TABLE egresos_creditek_entradas DROP CONSTRAINT IF EXISTS egresos_creditek_entradas_tipo_check;
ALTER TABLE egresos_creditek_entradas ADD CONSTRAINT egresos_creditek_entradas_tipo_check
CHECK (tipo IN ('ENTRADAS', 'CAJAS', 'TRANSFERENCIAS', 'DESCUENTOS', 'JEFES', 'MULTAS_FACTURACION', 'OTROS', 'PLAN_MOVISTAR', 'MECANICA', 'LENTES', 'PRESTAMO_EMPRESARIAL', 'CUOTAS_TELEFONO'));
COMMIT;
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'egresos_creditek_entradas' AND column_name = 'fechaFin';
