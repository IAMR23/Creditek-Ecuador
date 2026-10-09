DO $$
BEGIN
  IF to_regclass('public.modelos') IS NULL OR to_regclass('public.usuarios') IS NULL THEN
    RAISE EXCEPTION 'Faltan las tablas base modelos o usuarios';
  END IF;
END $$;

SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'logistica_masther_phone_ingresos',
    'logistica_masther_phone_conciliaciones'
  );

CREATE TABLE IF NOT EXISTS logistica_masther_phone_ingresos (
  id SERIAL PRIMARY KEY,
  "modeloId" INTEGER NOT NULL REFERENCES modelos(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  cantidad INTEGER NOT NULL,
  "fechaIngreso" DATE NOT NULL,
  bodega VARCHAR(20) NOT NULL,
  "registradoPorId" INTEGER REFERENCES usuarios(id) ON UPDATE CASCADE ON DELETE SET NULL,
  "requestKey" VARCHAR(64) NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT logistica_masther_phone_ingresos_cantidad_chk CHECK (cantidad > 0),
  CONSTRAINT logistica_masther_phone_ingresos_bodega_chk
    CHECK (bodega IN ('CREDITEK', 'PROVEEDOR')),
  CONSTRAINT logistica_masther_phone_ingresos_request_key_uk UNIQUE ("requestKey")
);

ALTER TABLE logistica_masther_phone_ingresos
  ADD COLUMN IF NOT EXISTS bodega VARCHAR(20);

UPDATE logistica_masther_phone_ingresos
SET bodega = 'PROVEEDOR'
WHERE bodega IS NULL OR bodega NOT IN ('CREDITEK', 'PROVEEDOR');

ALTER TABLE logistica_masther_phone_ingresos
  ALTER COLUMN bodega SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'logistica_masther_phone_ingresos_bodega_chk'
      AND conrelid = 'logistica_masther_phone_ingresos'::regclass
  ) THEN
    ALTER TABLE logistica_masther_phone_ingresos
      ADD CONSTRAINT logistica_masther_phone_ingresos_bodega_chk
      CHECK (bodega IN ('CREDITEK', 'PROVEEDOR'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS logistica_masther_phone_ingresos_modelo_fecha_idx
  ON logistica_masther_phone_ingresos ("modeloId", "fechaIngreso");

CREATE TABLE IF NOT EXISTS logistica_masther_phone_conciliaciones (
  id SERIAL PRIMARY KEY,
  "modeloId" INTEGER NOT NULL REFERENCES modelos(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  "semanaInicio" DATE NOT NULL,
  "stockCreditek" INTEGER NOT NULL,
  "actualizadoPorId" INTEGER REFERENCES usuarios(id) ON UPDATE CASCADE ON DELETE SET NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT logistica_masther_phone_conciliaciones_stock_chk CHECK ("stockCreditek" >= 0),
  CONSTRAINT logistica_masther_phone_conciliaciones_semana_chk
    CHECK (EXTRACT(ISODOW FROM "semanaInicio") = 1),
  CONSTRAINT logistica_masther_phone_conciliaciones_modelo_semana_uk
    UNIQUE ("modeloId", "semanaInicio")
);

CREATE INDEX IF NOT EXISTS logistica_masther_phone_conciliaciones_semana_idx
  ON logistica_masther_phone_conciliaciones ("semanaInicio");

SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'logistica_masther_phone_ingresos',
    'logistica_masther_phone_conciliaciones'
  )
ORDER BY table_name;
