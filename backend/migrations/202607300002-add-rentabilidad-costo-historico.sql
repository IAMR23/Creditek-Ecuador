-- Verificacion previa: muestra la rentabilidad esperada sin modificar datos.
SELECT
  id,
  costo,
  margen AS utilidad,
  CASE
    WHEN margen IS NOT NULL AND costo > 0
      THEN ROUND((margen::numeric / costo::numeric) * 100, 2)
    ELSE NULL
  END AS rentabilidad_esperada
FROM costo_historicos
ORDER BY id;

BEGIN;

ALTER TABLE costo_historicos
ADD COLUMN IF NOT EXISTS rentabilidad DECIMAL(10, 2);

UPDATE costo_historicos
SET
  rentabilidad = CASE
    WHEN margen IS NOT NULL AND costo > 0
      THEN ROUND((margen::numeric / costo::numeric) * 100, 2)
    ELSE NULL
  END,
  "updatedAt" = NOW()
WHERE rentabilidad IS DISTINCT FROM CASE
  WHEN margen IS NOT NULL AND costo > 0
    THEN ROUND((margen::numeric / costo::numeric) * 100, 2)
  ELSE NULL
END;

COMMIT;

-- Verificacion final: el resultado esperado es cero registros pendientes.
SELECT COUNT(*) AS registros_pendientes
FROM costo_historicos
WHERE rentabilidad IS DISTINCT FROM CASE
  WHEN margen IS NOT NULL AND costo > 0
    THEN ROUND((margen::numeric / costo::numeric) * 100, 2)
  ELSE NULL
END;
