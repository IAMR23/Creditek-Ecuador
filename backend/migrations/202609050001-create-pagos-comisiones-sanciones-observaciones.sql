-- Ejecutar antes de desplegar el backend. No modifica datos existentes.
SELECT to_regclass('public.pagos_comisiones_sanciones_observaciones') AS tabla_previa;

BEGIN;
CREATE TABLE IF NOT EXISTS pagos_comisiones_sanciones_observaciones (
  id SERIAL PRIMARY KEY,
  anio INTEGER NOT NULL CHECK (anio BETWEEN 1900 AND 2500),
  mes INTEGER NOT NULL CHECK (mes BETWEEN 1 AND 12),
  observacion TEXT NOT NULL DEFAULT '',
  "actualizadoPorId" INTEGER REFERENCES usuarios(id) ON UPDATE CASCADE ON DELETE SET NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (anio, mes)
);
COMMIT;

SELECT column_name, data_type FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'pagos_comisiones_sanciones_observaciones'
ORDER BY ordinal_position;
