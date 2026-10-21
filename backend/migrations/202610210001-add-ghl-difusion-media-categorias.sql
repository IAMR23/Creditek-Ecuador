-- Categorias e imagenes para la biblioteca y la cola de difusiones GHL.
CREATE TABLE IF NOT EXISTS ghl_difusion_categorias (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(80) NOT NULL,
  "creadoPorId" INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  "actualizadoPorId" INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ghl_difusion_categorias_nombre_check
    CHECK (CHAR_LENGTH(TRIM(nombre)) BETWEEN 2 AND 80)
);

CREATE UNIQUE INDEX IF NOT EXISTS ghl_difusion_categorias_nombre_unique
  ON ghl_difusion_categorias (LOWER(TRIM(nombre)));
CREATE INDEX IF NOT EXISTS ghl_difusion_categorias_updated_at_idx
  ON ghl_difusion_categorias ("updatedAt" DESC);

ALTER TABLE IF EXISTS ghl_difusion_mensajes
  ADD COLUMN IF NOT EXISTS "categoriaId" INTEGER,
  ADD COLUMN IF NOT EXISTS "imagenUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "imagenNombre" VARCHAR(255);

DO $$
BEGIN
  IF to_regclass('ghl_difusion_mensajes') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint
       WHERE conname = 'ghl_difusion_mensajes_categoria_fk'
         AND conrelid = 'ghl_difusion_mensajes'::regclass
     ) THEN
    ALTER TABLE ghl_difusion_mensajes
      ADD CONSTRAINT ghl_difusion_mensajes_categoria_fk
      FOREIGN KEY ("categoriaId") REFERENCES ghl_difusion_categorias(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS ghl_difusion_mensajes_categoria_idx
  ON ghl_difusion_mensajes ("categoriaId", nombre);

ALTER TABLE IF EXISTS ghl_difusion_ejecuciones
  ADD COLUMN IF NOT EXISTS imagenes JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE IF EXISTS ghl_difusion_ejecucion_detalles
  ADD COLUMN IF NOT EXISTS "imagenUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "imagenNombre" VARCHAR(255);

-- Verificacion segura:
-- SELECT id, nombre FROM ghl_difusion_categorias ORDER BY nombre;
-- SELECT id, nombre, "categoriaId", "imagenUrl" FROM ghl_difusion_mensajes ORDER BY id DESC;
-- SELECT id, mensajes, imagenes FROM ghl_difusion_ejecuciones ORDER BY id DESC LIMIT 10;

-- Reversion manual omitida para conservar imagenes, categorias e historicos.
