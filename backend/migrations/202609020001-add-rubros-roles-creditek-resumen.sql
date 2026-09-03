BEGIN;

ALTER TABLE roles_creditek_ajustes
  ADD COLUMN IF NOT EXISTS "transferenciasManual" DECIMAL(12, 2),
  ADD COLUMN IF NOT EXISTS "jefesManual" DECIMAL(12, 2),
  ADD COLUMN IF NOT EXISTS "otrosManual" DECIMAL(12, 2);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'roles_creditek_ajustes_transferencias_manual_check'
  ) THEN
    ALTER TABLE roles_creditek_ajustes
      ADD CONSTRAINT roles_creditek_ajustes_transferencias_manual_check
      CHECK ("transferenciasManual" IS NULL OR "transferenciasManual" >= 0)
      NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'roles_creditek_ajustes_jefes_manual_check'
  ) THEN
    ALTER TABLE roles_creditek_ajustes
      ADD CONSTRAINT roles_creditek_ajustes_jefes_manual_check
      CHECK ("jefesManual" IS NULL OR "jefesManual" >= 0)
      NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'roles_creditek_ajustes_otros_manual_check'
  ) THEN
    ALTER TABLE roles_creditek_ajustes
      ADD CONSTRAINT roles_creditek_ajustes_otros_manual_check
      CHECK ("otrosManual" IS NULL OR "otrosManual" >= 0)
      NOT VALID;
  END IF;
END $$;

ALTER TABLE roles_creditek_ajustes
  VALIDATE CONSTRAINT roles_creditek_ajustes_transferencias_manual_check;
ALTER TABLE roles_creditek_ajustes
  VALIDATE CONSTRAINT roles_creditek_ajustes_jefes_manual_check;
ALTER TABLE roles_creditek_ajustes
  VALIDATE CONSTRAINT roles_creditek_ajustes_otros_manual_check;

COMMIT;
