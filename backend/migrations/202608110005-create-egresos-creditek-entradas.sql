CREATE TABLE IF NOT EXISTS egresos_creditek_entradas (
  id SERIAL PRIMARY KEY,
  "usuarioId" INTEGER NOT NULL
    REFERENCES usuarios(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  valor DECIMAL(12, 2) NOT NULL CHECK (valor > 0),
  observacion TEXT,
  seccion VARCHAR(30) NOT NULL DEFAULT 'ENTRADAS',
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  "ultimaAccion" VARCHAR(20) NOT NULL DEFAULT 'CREADO',
  "registradoPorId" INTEGER NOT NULL
    REFERENCES usuarios(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  "actualizadoPorId" INTEGER
    REFERENCES usuarios(id) ON UPDATE CASCADE ON DELETE SET NULL,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

ALTER TABLE egresos_creditek_entradas
  ADD COLUMN IF NOT EXISTS observacion TEXT,
  ADD COLUMN IF NOT EXISTS seccion VARCHAR(30) NOT NULL DEFAULT 'ENTRADAS',
  ADD COLUMN IF NOT EXISTS activo BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS "ultimaAccion" VARCHAR(20) NOT NULL DEFAULT 'CREADO',
  ADD COLUMN IF NOT EXISTS "actualizadoPorId" INTEGER
    REFERENCES usuarios(id) ON UPDATE CASCADE ON DELETE SET NULL;

UPDATE egresos_creditek_entradas
SET seccion = 'ENTRADAS'
WHERE seccion IS NULL;

UPDATE egresos_creditek_entradas
SET activo = TRUE
WHERE activo IS NULL;

UPDATE egresos_creditek_entradas
SET "ultimaAccion" = 'CREADO'
WHERE "ultimaAccion" IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'egresos_creditek_entradas_seccion_check'
  ) THEN
    ALTER TABLE egresos_creditek_entradas
      ADD CONSTRAINT egresos_creditek_entradas_seccion_check
      CHECK (seccion IN ('ENTRADAS', 'CAJAS', 'TRANSFERENCIAS', 'DESCUENTOS'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'egresos_creditek_entradas_ultima_accion_check'
  ) THEN
    ALTER TABLE egresos_creditek_entradas
      ADD CONSTRAINT egresos_creditek_entradas_ultima_accion_check
      CHECK ("ultimaAccion" IN ('CREADO', 'EDITADO', 'DESACTIVADO', 'REACTIVADO'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS egresos_creditek_entradas_usuario_idx
  ON egresos_creditek_entradas ("usuarioId");

CREATE INDEX IF NOT EXISTS egresos_creditek_entradas_created_at_idx
  ON egresos_creditek_entradas ("createdAt");

CREATE INDEX IF NOT EXISTS egresos_creditek_entradas_seccion_idx
  ON egresos_creditek_entradas (seccion);

SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'egresos_creditek_entradas'
ORDER BY ordinal_position;
