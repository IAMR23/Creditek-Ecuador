SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'facturas'
  AND column_name IN ('cargadoPorId', 'revisada', 'revisadaAt', 'revisadaPorId');

ALTER TABLE public.facturas
  ADD COLUMN IF NOT EXISTS "cargadoPorId" INTEGER NULL,
  ADD COLUMN IF NOT EXISTS revisada BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "revisadaAt" TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS "revisadaPorId" INTEGER NULL;

UPDATE public.facturas
SET revisada = FALSE
WHERE revisada IS NULL;

CREATE INDEX IF NOT EXISTS facturas_cargado_por_idx
  ON public.facturas ("cargadoPorId");

CREATE INDEX IF NOT EXISTS facturas_revisada_idx
  ON public.facturas (revisada);

SELECT COUNT(*) AS total_facturas,
       COUNT(*) FILTER (WHERE revisada IS TRUE) AS total_revisadas,
       COUNT(*) FILTER (WHERE revisada IS FALSE) AS total_pendientes
FROM public.facturas;
