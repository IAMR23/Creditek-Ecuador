BEGIN;

-- Verificacion previa: muestra la restriccion vigente y los valores existentes.
SELECT conname, pg_get_constraintdef(oid) AS definicion
FROM pg_constraint
WHERE conname = 'usuarios_jornada_laboral_check'
  AND conrelid = 'public.usuarios'::regclass;

SELECT "jornadaLaboral", COUNT(*) AS total
FROM public.usuarios
GROUP BY "jornadaLaboral"
ORDER BY "jornadaLaboral";

-- Amplia de forma idempotente la restriccion; no modifica usuarios existentes.
DO $$
DECLARE
  definicion_actual TEXT;
BEGIN
  SELECT pg_get_constraintdef(oid)
  INTO definicion_actual
  FROM pg_constraint
  WHERE conname = 'usuarios_jornada_laboral_check'
    AND conrelid = 'public.usuarios'::regclass;

  IF definicion_actual IS NOT NULL
     AND POSITION('tres_cuartos_tiempo' IN definicion_actual) = 0 THEN
    ALTER TABLE public.usuarios
      DROP CONSTRAINT usuarios_jornada_laboral_check;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'usuarios_jornada_laboral_check'
      AND conrelid = 'public.usuarios'::regclass
  ) THEN
    ALTER TABLE public.usuarios
      ADD CONSTRAINT usuarios_jornada_laboral_check
      CHECK (
        "jornadaLaboral" IN (
          'tiempo_completo',
          'tres_cuartos_tiempo',
          'medio_tiempo'
        )
      ) NOT VALID;

    ALTER TABLE public.usuarios
      VALIDATE CONSTRAINT usuarios_jornada_laboral_check;
  END IF;
END $$;

-- Verificacion final: confirma la nueva restriccion y la distribucion de jornadas.
SELECT conname, pg_get_constraintdef(oid) AS definicion
FROM pg_constraint
WHERE conname = 'usuarios_jornada_laboral_check'
  AND conrelid = 'public.usuarios'::regclass;

SELECT "jornadaLaboral", COUNT(*) AS total
FROM public.usuarios
GROUP BY "jornadaLaboral"
ORDER BY "jornadaLaboral";

COMMIT;
