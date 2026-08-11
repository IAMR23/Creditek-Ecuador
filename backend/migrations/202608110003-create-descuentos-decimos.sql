SELECT to_regclass('public.descuentos_decimos') AS tabla_antes;

CREATE TABLE IF NOT EXISTS descuentos_decimos (
  id SERIAL PRIMARY KEY,
  "usuarioId" INTEGER NOT NULL
    REFERENCES usuarios(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  anio INTEGER NOT NULL CHECK (anio BETWEEN 2000 AND 2100),
  valor DECIMAL(12, 2) NOT NULL DEFAULT 0 CHECK (valor >= 0),
  "decimoCuarto" BOOLEAN NOT NULL DEFAULT FALSE,
  "decimoTercero" BOOLEAN NOT NULL DEFAULT FALSE,
  vacaciones BOOLEAN NOT NULL DEFAULT FALSE,
  observaciones TEXT NOT NULL DEFAULT '',
  "actualizadoPorId" INTEGER NULL
    REFERENCES usuarios(id) ON UPDATE CASCADE ON DELETE SET NULL,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS descuentos_decimos_usuario_anio_unique
  ON descuentos_decimos ("usuarioId", anio);

CREATE INDEX IF NOT EXISTS descuentos_decimos_anio_idx
  ON descuentos_decimos (anio);

SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'descuentos_decimos'
ORDER BY ordinal_position;
