SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'roles_creditek_ajustes'
  AND column_name = 'sueldo';

ALTER TABLE roles_creditek_ajustes
ADD COLUMN IF NOT EXISTS sueldo DECIMAL(12, 2) NOT NULL DEFAULT 0;

SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_name = 'roles_creditek_ajustes'
  AND column_name = 'sueldo';
