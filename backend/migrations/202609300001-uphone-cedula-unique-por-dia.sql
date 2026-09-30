-- Una misma persona puede generar solicitudes en fechas distintas. La
-- proteccion de duplicados por cedula se limita al dia calendario de Ecuador.
ALTER TABLE IF EXISTS uphone_solicitudes
  ADD COLUMN IF NOT EXISTS "fechaSolicitudDia" DATE;

DROP INDEX IF EXISTS uphone_solicitudes_cedula_normalizada_unique;

WITH cedulas_normalizadas AS (
  SELECT
    id,
    ("fechaSolicitud" AT TIME ZONE 'America/Guayaquil')::date AS fecha_solicitud_dia,
    CASE
      WHEN LENGTH(REGEXP_REPLACE(COALESCE(cedula, ''), '[^0-9]', '', 'g')) >= 6
        THEN REGEXP_REPLACE(cedula, '[^0-9]', '', 'g')
      ELSE NULL
    END AS cedula_normalizada
  FROM uphone_solicitudes
), cedulas_ordenadas AS (
  SELECT
    id,
    fecha_solicitud_dia,
    cedula_normalizada,
    ROW_NUMBER() OVER (
      PARTITION BY cedula_normalizada, fecha_solicitud_dia
      ORDER BY id
    ) AS posicion
  FROM cedulas_normalizadas
)
UPDATE uphone_solicitudes AS solicitud
SET
  "fechaSolicitudDia" = cedulas_ordenadas.fecha_solicitud_dia,
  "cedulaNormalizada" = CASE
    WHEN cedulas_ordenadas.cedula_normalizada IS NOT NULL
     AND cedulas_ordenadas.posicion = 1
      THEN cedulas_ordenadas.cedula_normalizada
    ELSE NULL
  END
FROM cedulas_ordenadas
WHERE solicitud.id = cedulas_ordenadas.id;

CREATE UNIQUE INDEX IF NOT EXISTS uphone_solicitudes_cedula_fecha_unique
  ON uphone_solicitudes ("cedulaNormalizada", "fechaSolicitudDia");

-- Verificacion: una cedula puede repetirse en dias diferentes, pero no dentro
-- del mismo dia cuando ambas llaves normalizadas estan presentes.
-- SELECT "cedulaNormalizada", "fechaSolicitudDia", COUNT(*)
-- FROM uphone_solicitudes
-- WHERE "cedulaNormalizada" IS NOT NULL
-- GROUP BY "cedulaNormalizada", "fechaSolicitudDia"
-- HAVING COUNT(*) > 1;
