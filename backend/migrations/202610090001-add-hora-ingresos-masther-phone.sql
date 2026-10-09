DO $$
DECLARE
  current_data_type TEXT;
BEGIN
  IF to_regclass('public.logistica_masther_phone_ingresos') IS NULL THEN
    RAISE EXCEPTION 'Falta la tabla logistica_masther_phone_ingresos';
  END IF;

  SELECT data_type
  INTO current_data_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'logistica_masther_phone_ingresos'
    AND column_name = 'fechaIngreso';

  IF current_data_type IS NULL THEN
    RAISE EXCEPTION 'Falta la columna fechaIngreso';
  ELSIF current_data_type = 'date' THEN
    ALTER TABLE logistica_masther_phone_ingresos
      ALTER COLUMN "fechaIngreso" TYPE TIMESTAMPTZ
      USING ("fechaIngreso"::TIMESTAMP AT TIME ZONE 'America/Guayaquil');
  ELSIF current_data_type <> 'timestamp with time zone' THEN
    RAISE EXCEPTION 'Tipo inesperado para fechaIngreso: %', current_data_type;
  END IF;
END $$;

SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'logistica_masther_phone_ingresos'
  AND column_name = 'fechaIngreso';
