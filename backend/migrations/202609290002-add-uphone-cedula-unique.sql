-- Evita nuevas solicitudes Uphone con una cedula ya registrada.
ALTER TABLE IF EXISTS uphone_solicitudes
  ADD COLUMN IF NOT EXISTS "cedulaNormalizada" VARCHAR(30);

-- Conserva todo el historico. Si ya existen cedulas repetidas, solamente la
-- primera fila mantiene la llave normalizada; las demas filas no se eliminan.
WITH cedulas_normalizadas AS (
  SELECT
    id,
    CASE
      WHEN LENGTH(REGEXP_REPLACE(COALESCE(cedula, ''), '[^0-9]', '', 'g')) >= 6
        THEN REGEXP_REPLACE(cedula, '[^0-9]', '', 'g')
      ELSE NULL
    END AS cedula_normalizada
  FROM uphone_solicitudes
), cedulas_ordenadas AS (
  SELECT
    id,
    cedula_normalizada,
    ROW_NUMBER() OVER (PARTITION BY cedula_normalizada ORDER BY id) AS posicion
  FROM cedulas_normalizadas
)
UPDATE uphone_solicitudes AS solicitud
SET "cedulaNormalizada" = CASE
  WHEN cedulas_ordenadas.cedula_normalizada IS NOT NULL
   AND cedulas_ordenadas.posicion = 1
    THEN cedulas_ordenadas.cedula_normalizada
  ELSE NULL
END
FROM cedulas_ordenadas
WHERE solicitud.id = cedulas_ordenadas.id
  AND solicitud."cedulaNormalizada" IS DISTINCT FROM CASE
    WHEN cedulas_ordenadas.cedula_normalizada IS NOT NULL
     AND cedulas_ordenadas.posicion = 1
      THEN cedulas_ordenadas.cedula_normalizada
    ELSE NULL
  END;

CREATE UNIQUE INDEX IF NOT EXISTS uphone_solicitudes_cedula_normalizada_unique
  ON uphone_solicitudes ("cedulaNormalizada");

-- Verificacion previa/posterior:
-- SELECT "cedulaNormalizada", COUNT(*)
-- FROM uphone_solicitudes
-- WHERE "cedulaNormalizada" IS NOT NULL
-- GROUP BY "cedulaNormalizada"
-- HAVING COUNT(*) > 1;
-- Debe devolver cero filas. No se eliminan solicitudes historicas.
