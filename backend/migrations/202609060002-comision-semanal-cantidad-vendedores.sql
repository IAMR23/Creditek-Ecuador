-- NULL mantiene la cantidad real del equipo como configuracion automatica.
SELECT column_name FROM information_schema.columns
WHERE table_name = 'pagos_comisiones_equipos_semanales' AND column_name = 'cantidadVendedoresComision';
ALTER TABLE pagos_comisiones_equipos_semanales ADD COLUMN IF NOT EXISTS "cantidadVendedoresComision" INTEGER;
SELECT column_name, data_type, is_nullable FROM information_schema.columns
WHERE table_name = 'pagos_comisiones_equipos_semanales' AND column_name = 'cantidadVendedoresComision';
