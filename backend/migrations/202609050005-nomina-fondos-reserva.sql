-- Verificar antes y despues. NULL conserva el calculo automatico.
SELECT column_name FROM information_schema.columns
WHERE table_name = 'roles_creditek_ajustes' AND column_name = 'fondosReservaManual';
ALTER TABLE roles_creditek_ajustes ADD COLUMN IF NOT EXISTS "fondosReservaManual" NUMERIC(12,2);
SELECT column_name, data_type, is_nullable FROM information_schema.columns
WHERE table_name = 'roles_creditek_ajustes' AND column_name = 'fondosReservaManual';
