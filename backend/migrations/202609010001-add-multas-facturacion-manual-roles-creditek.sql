SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'roles_creditek_ajustes'
  AND column_name IN ('multasFacturacion', 'multasFacturacionManual')
ORDER BY column_name;

ALTER TABLE roles_creditek_ajustes
  ADD COLUMN IF NOT EXISTS "multasFacturacionManual" DECIMAL(12, 2) NULL;

UPDATE roles_creditek_ajustes
SET "multasFacturacionManual" = "multasFacturacion"
WHERE "multasFacturacionManual" IS NULL
  AND "multasFacturacion" <> 0;

SELECT
  COUNT(*) FILTER (WHERE "multasFacturacionManual" IS NOT NULL) AS ajustes_manuales,
  COUNT(*) FILTER (WHERE "multasFacturacion" <> 0) AS valores_legacy_conservados
FROM roles_creditek_ajustes;
