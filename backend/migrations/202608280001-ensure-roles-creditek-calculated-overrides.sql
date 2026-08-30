ALTER TABLE roles_creditek_ajustes
  ADD COLUMN IF NOT EXISTS "descuentosMetaManual" DECIMAL(12, 2),
  ADD COLUMN IF NOT EXISTS "cajaGeneralManual" DECIMAL(12, 2),
  ADD COLUMN IF NOT EXISTS "entradasManual" DECIMAL(12, 2),
  ADD COLUMN IF NOT EXISTS "descuentosManual" DECIMAL(12, 2);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'roles_creditek_ajustes_descuentos_meta_manual_check'
  ) THEN
    ALTER TABLE roles_creditek_ajustes
      ADD CONSTRAINT roles_creditek_ajustes_descuentos_meta_manual_check
      CHECK ("descuentosMetaManual" IS NULL OR "descuentosMetaManual" >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'roles_creditek_ajustes_caja_general_manual_check'
  ) THEN
    ALTER TABLE roles_creditek_ajustes
      ADD CONSTRAINT roles_creditek_ajustes_caja_general_manual_check
      CHECK ("cajaGeneralManual" IS NULL OR "cajaGeneralManual" >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'roles_creditek_ajustes_entradas_manual_check'
  ) THEN
    ALTER TABLE roles_creditek_ajustes
      ADD CONSTRAINT roles_creditek_ajustes_entradas_manual_check
      CHECK ("entradasManual" IS NULL OR "entradasManual" >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'roles_creditek_ajustes_descuentos_manual_check'
  ) THEN
    ALTER TABLE roles_creditek_ajustes
      ADD CONSTRAINT roles_creditek_ajustes_descuentos_manual_check
      CHECK ("descuentosManual" IS NULL OR "descuentosManual" >= 0);
  END IF;
END $$;
