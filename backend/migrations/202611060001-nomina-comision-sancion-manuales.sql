ALTER TABLE roles_creditek_ajustes
  ADD COLUMN IF NOT EXISTS "comisionVentaManual" NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS "sancionMetaManual" NUMERIC(12, 2);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'roles_creditek_ajustes_comision_venta_manual_check'
  ) THEN
    ALTER TABLE roles_creditek_ajustes
      ADD CONSTRAINT roles_creditek_ajustes_comision_venta_manual_check
      CHECK ("comisionVentaManual" IS NULL OR "comisionVentaManual" >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'roles_creditek_ajustes_sancion_meta_manual_check'
  ) THEN
    ALTER TABLE roles_creditek_ajustes
      ADD CONSTRAINT roles_creditek_ajustes_sancion_meta_manual_check
      CHECK ("sancionMetaManual" IS NULL OR "sancionMetaManual" >= 0);
  END IF;
END $$;
