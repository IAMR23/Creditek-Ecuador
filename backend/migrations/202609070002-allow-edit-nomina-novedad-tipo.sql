-- Los días manuales son históricos y ya no intervienen en el cálculo.
-- Permite corregir MATERNIDAD/LACTANCIA conservando ese historial.
SELECT to_regclass('public.nomina_novedades') AS tabla;
BEGIN;
SET LOCAL lock_timeout = '5s';
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
    IF dias_m < 0 OR dias_m > 30 OR dias_c < 0 OR dias_c > 30 OR coalesce(dias_m,0) + coalesce(dias_c,0) > 30 THEN
      RAISE EXCEPTION 'Distribución de días inválida' USING ERRCODE = '23514'; END IF;
  END LOOP;
  RETURN NEW;
END $$;
COMMIT;
SELECT tgname, tgenabled FROM pg_trigger
 WHERE tgrelid = 'public.nomina_novedades'::regclass AND tgname = 'validar_nomina_novedad_trigger';
