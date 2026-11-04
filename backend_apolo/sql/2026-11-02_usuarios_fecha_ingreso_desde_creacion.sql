-- ABS: recalcula fechaIngreso para todos los usuarios usando su fecha de creación.
-- Sobrescribe valores existentes, pero conserva un respaldo previo para reversión.
-- Revisar el SELECT previo y ejecutar primero en un ambiente de prueba.

BEGIN;

-- Verificación estructural: detiene la migración si la tabla o columnas no existen.
DO $$
BEGIN
  IF to_regclass('public.usuarios') IS NULL THEN
    RAISE EXCEPTION 'No existe la tabla public.usuarios';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'usuarios'
      AND column_name = 'fechaIngreso'
  ) THEN
    RAISE EXCEPTION 'No existe usuarios.fechaIngreso';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'usuarios'
      AND column_name = 'createdAt'
  ) THEN
    RAISE EXCEPTION 'No existe usuarios.createdAt';
  END IF;
END $$;

-- Vista previa de todos los registros que serán recalculados.
SELECT
  id,
  nombre,
  "fechaIngreso" AS fecha_ingreso_actual,
  "createdAt" AS fecha_creacion,
  CASE
    WHEN pg_typeof("createdAt") = 'timestamp with time zone'::regtype
      THEN timezone('America/Guayaquil', "createdAt")::date
    ELSE "createdAt"::date
  END AS fecha_ingreso_propuesta
FROM usuarios
WHERE "createdAt" IS NOT NULL
ORDER BY id;

-- Respaldo permanente e idempotente de los valores anteriores a esta migración.
CREATE TABLE IF NOT EXISTS usuarios_fecha_ingreso_respaldo_20261102 (
  "usuarioId" INTEGER PRIMARY KEY,
  "fechaIngresoAnterior" DATE,
  "fechaCreacionOriginal" TEXT NOT NULL,
  "respaldadoAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO usuarios_fecha_ingreso_respaldo_20261102 (
  "usuarioId",
  "fechaIngresoAnterior",
  "fechaCreacionOriginal"
)
SELECT
  id,
  "fechaIngreso",
  "createdAt"::text
FROM usuarios
ON CONFLICT ("usuarioId") DO NOTHING;

-- Actualización general: reemplaza fechaIngreso en todos los usuarios con createdAt.
UPDATE usuarios
SET
  "fechaIngreso" = CASE
    WHEN pg_typeof("createdAt") = 'timestamp with time zone'::regtype
      THEN timezone('America/Guayaquil', "createdAt")::date
    ELSE "createdAt"::date
  END,
  "updatedAt" = NOW()
WHERE "createdAt" IS NOT NULL;

-- Verificación final.
SELECT
  COUNT(*) FILTER (WHERE "fechaIngreso" IS NOT NULL) AS usuarios_con_fecha_ingreso,
  COUNT(*) FILTER (WHERE "fechaIngreso" IS NULL) AS usuarios_sin_fecha_ingreso,
  COUNT(*) FILTER (
    WHERE "fechaIngreso" = CASE
      WHEN pg_typeof("createdAt") = 'timestamp with time zone'::regtype
        THEN timezone('America/Guayaquil', "createdAt")::date
      ELSE "createdAt"::date
    END
  ) AS usuarios_con_fecha_igual_a_creacion
FROM usuarios;

-- Verifica que todos los usuarios hayan quedado respaldados.
SELECT
  (SELECT COUNT(*) FROM usuarios) AS total_usuarios,
  (SELECT COUNT(*) FROM usuarios_fecha_ingreso_respaldo_20261102) AS total_respaldados;

COMMIT;

-- Reversión manual, solo si fuera necesaria:
-- BEGIN;
-- UPDATE usuarios AS u
-- SET
--   "fechaIngreso" = r."fechaIngresoAnterior",
--   "updatedAt" = NOW()
-- FROM usuarios_fecha_ingreso_respaldo_20261102 AS r
-- WHERE u.id = r."usuarioId";
-- COMMIT;

