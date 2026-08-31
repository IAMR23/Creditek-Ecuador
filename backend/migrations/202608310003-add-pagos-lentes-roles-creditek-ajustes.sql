SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'roles_creditek_ajustes'
  AND column_name = 'pagosLentes';

ALTER TABLE roles_creditek_ajustes
  ADD COLUMN IF NOT EXISTS "pagosLentes" DECIMAL(12, 2) NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'roles_creditek_ajustes_pagos_lentes_check'
  ) THEN
    ALTER TABLE roles_creditek_ajustes
      ADD CONSTRAINT roles_creditek_ajustes_pagos_lentes_check
      CHECK ("pagosLentes" >= 0);
  END IF;
END $$;

SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'roles_creditek_ajustes'
  AND column_name = 'pagosLentes';
