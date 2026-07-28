-- Verificacion previa: debe devolver NULL antes de la primera ejecucion.
SELECT to_regclass('public.pautas_marketing') AS tabla_actual;

CREATE TABLE IF NOT EXISTS pautas_marketing (
  id SERIAL PRIMARY KEY,
  producto VARCHAR(120) NOT NULL,
  "nombrePagina" VARCHAR(160) NOT NULL,
  imagen VARCHAR(500) NOT NULL,
  "seguidoresFacebook" BIGINT NOT NULL DEFAULT 0
    CHECK ("seguidoresFacebook" >= 0),
  "seguidoresInstagram" BIGINT NOT NULL DEFAULT 0
    CHECK ("seguidoresInstagram" >= 0),
  "seguidoresTiktok" BIGINT NOT NULL DEFAULT 0
    CHECK ("seguidoresTiktok" >= 0),
  "tipoContenido" VARCHAR(80) NOT NULL,
  contenidos JSONB NOT NULL DEFAULT '[]'::jsonb,
  "creadoPorId" INTEGER,
  "actualizadoPorId" INTEGER,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS pautas_marketing_activo_producto_idx
ON pautas_marketing (activo, producto);

CREATE INDEX IF NOT EXISTS pautas_marketing_tipo_contenido_idx
ON pautas_marketing ("tipoContenido");

-- Verificacion posterior de estructura e indices.
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'pautas_marketing'
ORDER BY ordinal_position;

SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'pautas_marketing'
ORDER BY indexname;
