-- NULL conserva el calculo automatico de los periodos sin ajuste.
SELECT column_name FROM information_schema.columns
WHERE table_name = 'roles_creditek_ajustes' AND column_name = 'sueldosExtrasManual';
ALTER TABLE roles_creditek_ajustes ADD COLUMN IF NOT EXISTS "sueldosExtrasManual" NUMERIC(12,2);
SELECT column_name, data_type, is_nullable FROM information_schema.columns
WHERE table_name = 'roles_creditek_ajustes' AND column_name = 'sueldosExtrasManual';
