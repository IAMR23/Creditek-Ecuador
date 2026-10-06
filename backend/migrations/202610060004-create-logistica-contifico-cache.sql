BEGIN;

SELECT to_regclass('public.logistica_contifico_cache') AS cache_actual;

CREATE TABLE IF NOT EXISTS logistica_contifico_cache (
  "cacheKey" VARCHAR(100) PRIMARY KEY,
  tipo VARCHAR(30) NOT NULL,
  contenido JSONB NOT NULL,
  "consultedAt" TIMESTAMPTZ NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT logistica_contifico_cache_key_chk
    CHECK (NULLIF(BTRIM("cacheKey"), '') IS NOT NULL),
  CONSTRAINT logistica_contifico_cache_tipo_chk
    CHECK (tipo IN ('CATALOGO', 'STOCK_PRODUCTO'))
);

CREATE INDEX IF NOT EXISTS logistica_contifico_cache_tipo_fecha_idx
  ON logistica_contifico_cache (tipo, "consultedAt" DESC);

COMMIT;

SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'logistica_contifico_cache'
ORDER BY ordinal_position;
