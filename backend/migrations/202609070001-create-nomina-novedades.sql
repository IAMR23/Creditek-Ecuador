-- RVE. Aplicar antes de habilitar Novedad de nómina. No modifica tablas históricas.
SELECT to_regclass('public.nomina_novedades') AS tabla_antes;
BEGIN;
SET LOCAL lock_timeout = '5s';
CREATE TABLE IF NOT EXISTS public.nomina_novedades (
  id SERIAL PRIMARY KEY,
  "usuarioId" INTEGER NOT NULL REFERENCES public.usuarios(id) ON DELETE RESTRICT,
  tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('MATERNIDAD', 'LACTANCIA')),
  "fechaInicio" DATE NOT NULL,
  "fechaFin" DATE NOT NULL,
  "fechaRetorno" DATE,
  "porcentajeEmpleador" NUMERIC(5,2) NOT NULL DEFAULT 25 CHECK ("porcentajeEmpleador" BETWEEN 0 AND 100),
  "porcentajeIess" NUMERIC(5,2) NOT NULL DEFAULT 75 CHECK ("porcentajeIess" BETWEEN 0 AND 100),
  "ajustesMensuales" JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof("ajustesMensuales") = 'object'),
  observacion TEXT NOT NULL DEFAULT '',
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  "creadoPorId" INTEGER NOT NULL REFERENCES public.usuarios(id) ON DELETE RESTRICT,
  "actualizadoPorId" INTEGER NOT NULL REFERENCES public.usuarios(id) ON DELETE RESTRICT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK ("fechaFin" >= "fechaInicio"),
  CHECK ("fechaRetorno" IS NULL OR "fechaRetorno" >= "fechaInicio"),
  CHECK ("porcentajeEmpleador" + "porcentajeIess" = 100)
);
CREATE INDEX IF NOT EXISTS nomina_novedades_usuario_periodo_idx
  ON public.nomina_novedades ("usuarioId", activo, "fechaInicio", "fechaFin");
-- También valida una tabla que Sequelize haya creado antes de aplicar este SQL.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.nomina_novedades'::regclass AND conname = 'nomina_novedades_reglas_check') THEN
    ALTER TABLE public.nomina_novedades ADD CONSTRAINT nomina_novedades_reglas_check CHECK (
      tipo IN ('MATERNIDAD', 'LACTANCIA') AND "fechaFin" >= "fechaInicio"
      AND ("fechaRetorno" IS NULL OR "fechaRetorno" >= "fechaInicio")
      AND "porcentajeEmpleador" BETWEEN 0 AND 100 AND "porcentajeIess" BETWEEN 0 AND 100
      AND "porcentajeEmpleador" + "porcentajeIess" = 100
      AND jsonb_typeof("ajustesMensuales") = 'object'
    );
  END IF;
END $$;
-- Serializa cambios de una persona y protege también frente a escrituras SQL simultáneas.
CREATE OR REPLACE FUNCTION public.validar_nomina_novedad() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE ajuste RECORD; dias_m NUMERIC; dias_c NUMERIC;
BEGIN
  PERFORM id FROM public.usuarios WHERE id = NEW."usuarioId" FOR UPDATE;
  IF NEW.activo AND NEW.tipo = 'MATERNIDAD' AND EXISTS (
    SELECT 1 FROM public.nomina_novedades n WHERE n."usuarioId" = NEW."usuarioId"
      AND n.activo AND n.tipo = 'MATERNIDAD' AND n.id <> NEW.id
      AND n."fechaInicio" <= NEW."fechaFin" AND n."fechaFin" >= NEW."fechaInicio"
  ) THEN RAISE EXCEPTION 'Maternidades superpuestas' USING ERRCODE = '23514'; END IF;
  FOR ajuste IN SELECT * FROM jsonb_each(NEW."ajustesMensuales") LOOP
    IF ajuste.key !~ '^\d{4}-(0[1-9]|1[0-2])$' OR jsonb_typeof(ajuste.value) <> 'object' THEN
      RAISE EXCEPTION 'Ajuste mensual inválido' USING ERRCODE = '23514'; END IF;
    dias_m := (ajuste.value->>'diasMaternidad25Manual')::numeric;
    dias_c := (ajuste.value->>'diasSueldoCompletoManual')::numeric;
    IF dias_m < 0 OR dias_m > 30 OR dias_c < 0 OR dias_c > 30 OR coalesce(dias_m,0) + coalesce(dias_c,0) > 30
      OR (NEW.tipo = 'LACTANCIA' AND (dias_m IS NOT NULL OR dias_c IS NOT NULL)) THEN
      RAISE EXCEPTION 'Distribución de días inválida' USING ERRCODE = '23514'; END IF;
  END LOOP;
  RETURN NEW;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.nomina_novedades'::regclass AND tgname = 'validar_nomina_novedad_trigger') THEN
    CREATE TRIGGER validar_nomina_novedad_trigger BEFORE INSERT OR UPDATE ON public.nomina_novedades
      FOR EACH ROW EXECUTE FUNCTION public.validar_nomina_novedad();
  END IF;
END $$;
COMMIT;
SELECT column_name, data_type FROM information_schema.columns
 WHERE table_schema = 'public' AND table_name = 'nomina_novedades' ORDER BY ordinal_position;
