-- Verificacion previa del campo, clave foranea e indice.
BEGIN;

SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'entregas'
  AND column_name = 'ventaId';

SELECT constraint_name, update_rule, delete_rule
FROM information_schema.referential_constraints
WHERE constraint_schema = 'public'
  AND constraint_name = 'entregas_ventaId_fkey';

SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'entregas'
  AND indexdef LIKE '%"ventaId"%';

-- La columna es nullable para conservar entregas sin venta o ambiguas.
ALTER TABLE entregas
  ADD COLUMN IF NOT EXISTS "ventaId" INTEGER;

-- La restriccion se crea solo cuando no existe otra FK sobre ventaId.
-- NOT VALID conserva posibles referencias historicas huerfanas y exige
-- integridad para las escrituras nuevas.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint restriccion
    INNER JOIN pg_attribute columna
      ON columna.attrelid = restriccion.conrelid
     AND columna.attnum = ANY(restriccion.conkey)
    WHERE restriccion.conrelid = 'entregas'::regclass
      AND restriccion.contype = 'f'
      AND columna.attname = 'ventaId'
  ) THEN
    ALTER TABLE entregas
      ADD CONSTRAINT "entregas_ventaId_fkey"
      FOREIGN KEY ("ventaId") REFERENCES ventas(id)
      ON UPDATE CASCADE
      ON DELETE SET NULL
      NOT VALID;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS entregas_venta_id_idx
  ON entregas ("ventaId");

-- Primera conciliacion: mismo clienteId y una sola venta activa candidata.
WITH candidatas_cliente AS (
  SELECT
    entrega.id AS entrega_id,
    MIN(venta.id) AS venta_id,
    COUNT(DISTINCT venta.id) AS cantidad
  FROM entregas entrega
  INNER JOIN ventas venta
    ON venta."clienteId" = entrega."clienteId"
   AND venta.activo IS TRUE
  WHERE entrega."ventaId" IS NULL
  GROUP BY entrega.id
)
UPDATE entregas entrega
SET
  "ventaId" = candidata.venta_id,
  "updatedAt" = NOW()
FROM candidatas_cliente candidata
WHERE entrega.id = candidata.entrega_id
  AND candidata.cantidad = 1
  AND entrega."ventaId" IS NULL;

-- Segunda conciliacion: cedula normalizada, solo cuando clienteId no produjo
-- candidatas y existe exactamente una venta activa para esa cedula valida.
WITH entregas_sin_venta_cliente AS (
  SELECT
    entrega.id,
    REGEXP_REPLACE(COALESCE(cliente_entrega.cedula, ''), '[^0-9]', '', 'g')
      AS cedula_normalizada
  FROM entregas entrega
  INNER JOIN clientes cliente_entrega
    ON cliente_entrega.id = entrega."clienteId"
  WHERE entrega."ventaId" IS NULL
    AND NOT EXISTS (
      SELECT 1
      FROM ventas venta_cliente
      WHERE venta_cliente."clienteId" = entrega."clienteId"
        AND venta_cliente.activo IS TRUE
    )
),
candidatas_cedula AS (
  SELECT
    entrega.id AS entrega_id,
    MIN(venta.id) AS venta_id,
    COUNT(DISTINCT venta.id) AS cantidad
  FROM entregas_sin_venta_cliente entrega
  INNER JOIN clientes cliente_venta
    ON REGEXP_REPLACE(
      COALESCE(cliente_venta.cedula, ''),
      '[^0-9]',
      '',
      'g'
    ) = entrega.cedula_normalizada
  INNER JOIN ventas venta
    ON venta."clienteId" = cliente_venta.id
   AND venta.activo IS TRUE
  WHERE LENGTH(entrega.cedula_normalizada) IN (10, 13)
  GROUP BY entrega.id
)
UPDATE entregas entrega
SET
  "ventaId" = candidata.venta_id,
  "updatedAt" = NOW()
FROM candidatas_cedula candidata
WHERE entrega.id = candidata.entrega_id
  AND candidata.cantidad = 1
  AND entrega."ventaId" IS NULL;

-- Validar la FK solo cuando no existen referencias historicas huerfanas.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'entregas'::regclass
      AND conname = 'entregas_ventaId_fkey'
      AND NOT convalidated
  ) AND NOT EXISTS (
    SELECT 1
    FROM entregas entrega
    LEFT JOIN ventas venta ON venta.id = entrega."ventaId"
    WHERE entrega."ventaId" IS NOT NULL
      AND venta.id IS NULL
  ) THEN
    ALTER TABLE entregas
      VALIDATE CONSTRAINT "entregas_ventaId_fkey";
  END IF;
END $$;

-- Resumen final. Las ambiguas permanecen con ventaId NULL.
WITH diagnostico AS (
  SELECT
    entrega.id,
    entrega."ventaId",
    REGEXP_REPLACE(COALESCE(cliente.cedula, ''), '[^0-9]', '', 'g')
      AS cedula_normalizada,
    (
      SELECT COUNT(DISTINCT venta.id)
      FROM ventas venta
      WHERE venta."clienteId" = entrega."clienteId"
        AND venta.activo IS TRUE
    ) AS candidatas_cliente,
    (
      SELECT COUNT(DISTINCT venta.id)
      FROM ventas venta
      INNER JOIN clientes cliente_venta ON cliente_venta.id = venta."clienteId"
      WHERE venta.activo IS TRUE
        AND LENGTH(
          REGEXP_REPLACE(COALESCE(cliente.cedula, ''), '[^0-9]', '', 'g')
        ) IN (10, 13)
        AND REGEXP_REPLACE(
          COALESCE(cliente_venta.cedula, ''),
          '[^0-9]',
          '',
          'g'
        ) = REGEXP_REPLACE(
          COALESCE(cliente.cedula, ''),
          '[^0-9]',
          '',
          'g'
        )
    ) AS candidatas_cedula
  FROM entregas entrega
  LEFT JOIN clientes cliente ON cliente.id = entrega."clienteId"
)
SELECT
  COUNT(*) FILTER (WHERE "ventaId" IS NOT NULL) AS entregas_vinculadas,
  COUNT(*) FILTER (
    WHERE "ventaId" IS NULL
      AND (
        candidatas_cliente > 1
        OR (candidatas_cliente = 0 AND candidatas_cedula > 1)
      )
  ) AS entregas_ambiguas,
  COUNT(*) FILTER (
    WHERE "ventaId" IS NULL
      AND candidatas_cliente = 0
      AND candidatas_cedula = 0
  ) AS entregas_sin_coincidencia
FROM diagnostico;

-- Debe devolver cero para confirmar integridad referencial completa.
SELECT COUNT(*) AS relaciones_huerfanas
FROM entregas entrega
LEFT JOIN ventas venta ON venta.id = entrega."ventaId"
WHERE entrega."ventaId" IS NOT NULL
  AND venta.id IS NULL;

COMMIT;
