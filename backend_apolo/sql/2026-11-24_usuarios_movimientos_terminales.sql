-- ABS: controla qué usuarios aparecen en Movimientos de Terminales.
-- Es idempotente, no elimina datos y deja fuera a los usuarios inactivos.
BEGIN;

DO $$
BEGIN
  IF to_regclass('public.usuarios') IS NULL THEN
    RAISE EXCEPTION 'No existe la tabla public.usuarios';
  END IF;
END $$;

ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS "mostrarEnMovimientosTerminales" BOOLEAN;

-- Vista previa del valor que recibirá cada usuario.
SELECT
  id,
  nombre,
  activo,
  "mostrarEnMovimientosTerminales" AS valor_actual,
  COALESCE(
    "mostrarEnMovimientosTerminales",
    CASE WHEN activo IS FALSE THEN FALSE ELSE TRUE END
  ) AS valor_propuesto
FROM usuarios
ORDER BY id;

UPDATE usuarios
SET "mostrarEnMovimientosTerminales" = CASE
  WHEN activo IS FALSE THEN FALSE
  ELSE TRUE
END
WHERE "mostrarEnMovimientosTerminales" IS NULL;

ALTER TABLE usuarios
  ALTER COLUMN "mostrarEnMovimientosTerminales" SET DEFAULT TRUE,
  ALTER COLUMN "mostrarEnMovimientosTerminales" SET NOT NULL;

-- Verificación final.
SELECT
  COUNT(*) AS total_usuarios,
  COUNT(*) FILTER (WHERE "mostrarEnMovimientosTerminales" IS TRUE) AS visibles_en_terminales,
  COUNT(*) FILTER (WHERE "mostrarEnMovimientosTerminales" IS FALSE) AS ocultos_en_terminales,
  COUNT(*) FILTER (
    WHERE activo IS FALSE AND "mostrarEnMovimientosTerminales" IS TRUE
  ) AS inactivos_visibles_incorrectamente
FROM usuarios;

COMMIT;

-- Reversión manual, solo si fuera necesaria:
-- ALTER TABLE usuarios DROP COLUMN IF EXISTS "mostrarEnMovimientosTerminales";
