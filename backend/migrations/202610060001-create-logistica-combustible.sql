BEGIN;

-- Verificación previa; no se modifica ninguna tabla de logística existente.
SELECT to_regclass('public.usuarios') AS usuarios,
       to_regclass('public.logistica_combustible_registros') AS combustible;

CREATE TABLE IF NOT EXISTS logistica_combustible_registros (
  id SERIAL PRIMARY KEY,
  "userId" INTEGER NOT NULL REFERENCES usuarios(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  fecha DATE NOT NULL,
  "kilometrajeInicial" NUMERIC(10,2) NOT NULL,
  "kilometrajeFinal" NUMERIC(10,2) NOT NULL,
  "kilometrosRecorridos" NUMERIC(10,2) NOT NULL,
  "combustibleConsumido" NUMERIC(10,2) NOT NULL,
  "costoCombustible" NUMERIC(10,2) NOT NULL,
  observacion VARCHAR(2000) NOT NULL DEFAULT '',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "deletedAt" TIMESTAMPTZ
);

-- También protege tablas creadas previamente por sequelize.sync().
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'logistica_combustible_valores_chk'
      AND conrelid = 'logistica_combustible_registros'::regclass
  ) THEN
    ALTER TABLE logistica_combustible_registros
      ADD CONSTRAINT logistica_combustible_valores_chk CHECK (
        fecha >= DATE '1900-01-01' AND fecha <= DATE '9999-12-31'
        AND "kilometrajeInicial" >= 0
        AND "kilometrajeFinal" >= "kilometrajeInicial"
        AND "kilometrosRecorridos" = "kilometrajeFinal" - "kilometrajeInicial"
        AND "combustibleConsumido" >= 0 AND "costoCombustible" >= 0
        AND ("combustibleConsumido" > 0 OR "costoCombustible" = 0)
        AND "kilometrajeInicial" < 100000000 AND "kilometrajeFinal" < 100000000
        AND "combustibleConsumido" < 100000000 AND "costoCombustible" < 100000000
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS logistica_combustible_usuario_fecha_idx
  ON logistica_combustible_registros ("userId", fecha);
CREATE INDEX IF NOT EXISTS logistica_combustible_fecha_idx
  ON logistica_combustible_registros (fecha);

COMMIT;

SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'logistica_combustible_registros'
ORDER BY ordinal_position;
