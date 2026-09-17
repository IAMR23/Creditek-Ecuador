-- Etapa 2: ejecutar solo despues del dry-run y de cualquier reconciliacion
-- explicita. Si hay duplicados, se detiene sin elegir un ganador.

BEGIN;

DO $$
DECLARE
  duplicados TEXT;
BEGIN
  SELECT string_agg(entrega_id::text || ':' || total::text, ', ' ORDER BY entrega_id)
  INTO duplicados
  FROM (
    SELECT entrega_id, COUNT(*) AS total
    FROM usuario_agencia_entrega
    WHERE activo = TRUE
    GROUP BY entrega_id
    HAVING COUNT(*) > 1
  ) AS conflictos;

  IF duplicados IS NOT NULL THEN
    RAISE EXCEPTION
      'Asignaciones activas duplicadas (entrega:total): %. Requieren reconciliacion explicita.',
      duplicados;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS usuario_agencia_entrega_una_activa_por_entrega
  ON usuario_agencia_entrega (entrega_id)
  WHERE activo = TRUE;

COMMIT;

-- Verificacion posterior (debe devolver cero filas):
-- SELECT entrega_id, COUNT(*) FROM usuario_agencia_entrega
-- WHERE activo = TRUE GROUP BY entrega_id HAVING COUNT(*) > 1;
