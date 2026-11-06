ALTER TABLE roles_creditek_ajustes
  ADD COLUMN IF NOT EXISTS "diasTrabajadosManual" INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'roles_creditek_ajustes_dias_trabajados_manual_rango'
  ) THEN
    ALTER TABLE roles_creditek_ajustes
      ADD CONSTRAINT roles_creditek_ajustes_dias_trabajados_manual_rango
      CHECK ("diasTrabajadosManual" IS NULL OR "diasTrabajadosManual" BETWEEN 0 AND 30);
  END IF;
END $$;
