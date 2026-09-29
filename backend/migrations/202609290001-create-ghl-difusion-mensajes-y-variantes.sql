-- Biblioteca compartida y variantes alternadas para difusiones GHL.
CREATE TABLE IF NOT EXISTS ghl_difusion_mensajes (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(120) NOT NULL,
  contenido TEXT NOT NULL,
  "creadoPorId" INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  "actualizadoPorId" INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ghl_difusion_mensajes_nombre_check
    CHECK (CHAR_LENGTH(TRIM(nombre)) BETWEEN 3 AND 120),
  CONSTRAINT ghl_difusion_mensajes_contenido_check
    CHECK (CHAR_LENGTH(TRIM(contenido)) BETWEEN 1 AND 4000)
);

CREATE UNIQUE INDEX IF NOT EXISTS ghl_difusion_mensajes_nombre_unique
  ON ghl_difusion_mensajes (LOWER(TRIM(nombre)));
CREATE INDEX IF NOT EXISTS ghl_difusion_mensajes_updated_at_idx
  ON ghl_difusion_mensajes ("updatedAt" DESC);

ALTER TABLE IF EXISTS ghl_difusion_ejecuciones
  ADD COLUMN IF NOT EXISTS mensajes JSONB NOT NULL DEFAULT '[]'::jsonb;

UPDATE ghl_difusion_ejecuciones
SET mensajes = jsonb_build_array(mensaje)
WHERE mensajes IS NULL
   OR jsonb_typeof(mensajes) <> 'array'
   OR jsonb_array_length(mensajes) = 0;

ALTER TABLE IF EXISTS ghl_difusion_ejecucion_detalles
  ADD COLUMN IF NOT EXISTS mensaje TEXT;

DO $$
BEGIN
  IF to_regclass('ghl_difusion_ejecuciones') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint
       WHERE conname = 'ghl_difusion_ejecuciones_mensajes_check'
         AND conrelid = 'ghl_difusion_ejecuciones'::regclass
     ) THEN
    ALTER TABLE ghl_difusion_ejecuciones
      ADD CONSTRAINT ghl_difusion_ejecuciones_mensajes_check
      CHECK (jsonb_typeof(mensajes) = 'array' AND jsonb_array_length(mensajes) BETWEEN 1 AND 10);
  END IF;
END $$;

-- Verificacion sugerida:
-- SELECT id, mensaje, mensajes FROM ghl_difusion_ejecuciones ORDER BY id DESC LIMIT 10;
-- SELECT id, nombre, CHAR_LENGTH(contenido) AS caracteres FROM ghl_difusion_mensajes ORDER BY nombre;

-- Reversion manual omitida para conservar campañas historicas y mensajes guardados.
