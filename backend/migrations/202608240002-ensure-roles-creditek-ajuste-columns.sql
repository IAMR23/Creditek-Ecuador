SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'roles_creditek_ajustes'
ORDER BY ordinal_position;

ALTER TABLE roles_creditek_ajustes
  ADD COLUMN IF NOT EXISTS "adelantosTransfer" DECIMAL(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "deudaJimena" DECIMAL(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS atrasos DECIMAL(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "diasNoLaborables" DECIMAL(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "multasFacturacion" DECIMAL(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS planmovi DECIMAL(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS prestamo DECIMAL(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS mecanica DECIMAL(12, 2) NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS roles_creditek_ajustes_usuario_periodo_unique
  ON roles_creditek_ajustes ("usuarioId", anio, mes);

CREATE INDEX IF NOT EXISTS roles_creditek_ajustes_periodo_idx
  ON roles_creditek_ajustes (anio, mes);

SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'roles_creditek_ajustes'
ORDER BY ordinal_position;
