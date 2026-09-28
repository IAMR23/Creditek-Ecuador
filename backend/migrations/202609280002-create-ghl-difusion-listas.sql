-- Listas dinamicas compartidas para difusiones GHL.
CREATE TABLE IF NOT EXISTS ghl_difusion_listas (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(120) NOT NULL,
  filtros JSONB NOT NULL DEFAULT '{}'::jsonb,
  "creadoPorId" INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  "actualizadoPorId" INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ghl_difusion_listas_filtros_object_check
    CHECK (jsonb_typeof(filtros) = 'object')
);

CREATE UNIQUE INDEX IF NOT EXISTS ghl_difusion_listas_nombre_unique
  ON ghl_difusion_listas (LOWER(TRIM(nombre)));
CREATE INDEX IF NOT EXISTS ghl_difusion_listas_updated_at_idx
  ON ghl_difusion_listas ("updatedAt" DESC);

-- Reversion manual deliberadamente omitida para no eliminar listas guardadas.
