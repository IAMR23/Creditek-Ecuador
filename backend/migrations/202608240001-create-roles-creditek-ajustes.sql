SELECT to_regclass('public.roles_creditek_ajustes') AS tabla_antes_de_migrar;

CREATE TABLE IF NOT EXISTS roles_creditek_ajustes (
  id SERIAL PRIMARY KEY,
  "usuarioId" INTEGER NOT NULL
    REFERENCES usuarios(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  anio INTEGER NOT NULL CHECK (anio BETWEEN 2000 AND 2100),
  mes INTEGER NOT NULL CHECK (mes BETWEEN 1 AND 12),
  "adelantosTransfer" DECIMAL(12, 2) NOT NULL DEFAULT 0
    CONSTRAINT roles_creditek_ajustes_adelantos_transfer_check
    CHECK ("adelantosTransfer" >= 0),
  "deudaJimena" DECIMAL(12, 2) NOT NULL DEFAULT 0 CHECK ("deudaJimena" >= 0),
  atrasos DECIMAL(12, 2) NOT NULL DEFAULT 0 CHECK (atrasos >= 0),
  "diasNoLaborables" DECIMAL(12, 2) NOT NULL DEFAULT 0 CHECK ("diasNoLaborables" >= 0),
  "multasFacturacion" DECIMAL(12, 2) NOT NULL DEFAULT 0 CHECK ("multasFacturacion" >= 0),
  planmovi DECIMAL(12, 2) NOT NULL DEFAULT 0
    CONSTRAINT roles_creditek_ajustes_planmovi_check CHECK (planmovi >= 0),
  prestamo DECIMAL(12, 2) NOT NULL DEFAULT 0
    CONSTRAINT roles_creditek_ajustes_prestamo_check CHECK (prestamo >= 0),
  mecanica DECIMAL(12, 2) NOT NULL DEFAULT 0
    CONSTRAINT roles_creditek_ajustes_mecanica_check CHECK (mecanica >= 0),
  "actualizadoPorId" INTEGER
    REFERENCES usuarios(id) ON UPDATE CASCADE ON DELETE SET NULL,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

ALTER TABLE roles_creditek_ajustes
  ADD COLUMN IF NOT EXISTS "adelantosTransfer" DECIMAL(12, 2) NOT NULL DEFAULT 0;

ALTER TABLE roles_creditek_ajustes
  ADD COLUMN IF NOT EXISTS planmovi DECIMAL(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS prestamo DECIMAL(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS mecanica DECIMAL(12, 2) NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'roles_creditek_ajustes_adelantos_transfer_check'
  ) THEN
    ALTER TABLE roles_creditek_ajustes
      ADD CONSTRAINT roles_creditek_ajustes_adelantos_transfer_check
      CHECK ("adelantosTransfer" >= 0);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'roles_creditek_ajustes_planmovi_check'
  ) THEN
    ALTER TABLE roles_creditek_ajustes
      ADD CONSTRAINT roles_creditek_ajustes_planmovi_check
      CHECK (planmovi >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'roles_creditek_ajustes_prestamo_check'
  ) THEN
    ALTER TABLE roles_creditek_ajustes
      ADD CONSTRAINT roles_creditek_ajustes_prestamo_check
      CHECK (prestamo >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'roles_creditek_ajustes_mecanica_check'
  ) THEN
    ALTER TABLE roles_creditek_ajustes
      ADD CONSTRAINT roles_creditek_ajustes_mecanica_check
      CHECK (mecanica >= 0);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS roles_creditek_ajustes_usuario_periodo_unique
  ON roles_creditek_ajustes ("usuarioId", anio, mes);

CREATE INDEX IF NOT EXISTS roles_creditek_ajustes_periodo_idx
  ON roles_creditek_ajustes (anio, mes);

SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'roles_creditek_ajustes'
ORDER BY ordinal_position;
