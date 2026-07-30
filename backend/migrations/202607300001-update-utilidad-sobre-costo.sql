-- Verificacion previa: muestra el margen existente y los dos porcentajes
-- esperados sin modificar datos.
SELECT
  id,
  "precioCarga",
  costo,
  margen,
  "margenPorcentual" AS margen_sobre_venta_actual,
  CASE
    WHEN "precioCarga" > 0 THEN ROUND(
      (("precioCarga"::numeric - costo::numeric) / "precioCarga"::numeric) * 100,
      2
    )
    ELSE NULL
  END AS margen_sobre_venta_esperado,
  ROUND(
    (("precioCarga"::numeric - costo::numeric) / NULLIF(costo::numeric, 0)) * 100,
    2
  ) AS utilidad_sobre_costo_esperada
FROM costo_historicos
WHERE "precioCarga" IS NOT NULL
  AND costo > 0
ORDER BY id;

BEGIN;

ALTER TABLE costo_historicos
ADD COLUMN IF NOT EXISTS "utilidadSobreCosto" DECIMAL(10, 2);

UPDATE costo_historicos
SET
  margen = ROUND("precioCarga"::numeric - costo::numeric, 2),
  "margenPorcentual" = CASE
    WHEN "precioCarga" > 0 THEN ROUND(
      (("precioCarga"::numeric - costo::numeric) / "precioCarga"::numeric) * 100,
      2
    )
    ELSE NULL
  END,
  "utilidadSobreCosto" = ROUND(
    (("precioCarga"::numeric - costo::numeric) / costo::numeric) * 100,
    2
  ),
  "updatedAt" = NOW()
WHERE "precioCarga" IS NOT NULL
  AND costo > 0
  AND (
    margen IS DISTINCT FROM ROUND("precioCarga"::numeric - costo::numeric, 2)
    OR "margenPorcentual" IS DISTINCT FROM CASE
      WHEN "precioCarga" > 0 THEN ROUND(
        (("precioCarga"::numeric - costo::numeric) / "precioCarga"::numeric) * 100,
        2
      )
      ELSE NULL
    END
    OR "utilidadSobreCosto" IS DISTINCT FROM ROUND(
      (("precioCarga"::numeric - costo::numeric) / costo::numeric) * 100,
      2
    )
  );

COMMIT;

-- Verificacion final: el resultado esperado es cero registros pendientes.
SELECT COUNT(*) AS registros_pendientes
FROM costo_historicos
WHERE "precioCarga" IS NOT NULL
  AND costo > 0
  AND (
    margen IS DISTINCT FROM ROUND("precioCarga"::numeric - costo::numeric, 2)
    OR "margenPorcentual" IS DISTINCT FROM CASE
      WHEN "precioCarga" > 0 THEN ROUND(
        (("precioCarga"::numeric - costo::numeric) / "precioCarga"::numeric) * 100,
        2
      )
      ELSE NULL
    END
    OR "utilidadSobreCosto" IS DISTINCT FROM ROUND(
      (("precioCarga"::numeric - costo::numeric) / costo::numeric) * 100,
      2
    )
  );
