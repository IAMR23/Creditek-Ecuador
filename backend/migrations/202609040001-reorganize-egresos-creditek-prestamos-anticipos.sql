-- Verificacion previa
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'egresos_creditek_entradas'
  AND column_name IN ('seccion', 'tipo', 'fecha', 'observacion')
ORDER BY column_name;

SELECT seccion, COUNT(*) AS registros, SUM(valor) AS total
FROM egresos_creditek_entradas
GROUP BY seccion
ORDER BY seccion;

ALTER TABLE egresos_creditek_entradas
  ADD COLUMN IF NOT EXISTS tipo VARCHAR(30) NOT NULL DEFAULT 'ENTRADAS';

UPDATE egresos_creditek_entradas
SET tipo = COALESCE(
      CASE
        WHEN tipo IN (
          'ENTRADAS',
          'CAJAS',
          'TRANSFERENCIAS',
          'DESCUENTOS',
          'JEFES',
          'MULTAS_FACTURACION',
          'OTROS'
        )
          THEN tipo
        ELSE NULL
      END,
      CASE
        WHEN seccion IN (
          'ENTRADAS',
          'CAJAS',
          'TRANSFERENCIAS',
          'DESCUENTOS',
          'JEFES',
          'MULTAS_FACTURACION',
          'OTROS'
        )
          THEN seccion
        ELSE 'ENTRADAS'
      END
    ),
    seccion = CASE
      WHEN seccion IN ('PRESTAMOS', 'ANTICIPOS') THEN seccion
      ELSE 'ANTICIPOS'
    END
WHERE seccion IS NULL
   OR seccion NOT IN ('PRESTAMOS', 'ANTICIPOS')
   OR tipo IS NULL
   OR tipo = ''
   OR tipo NOT IN (
     'ENTRADAS',
     'CAJAS',
     'TRANSFERENCIAS',
     'DESCUENTOS',
     'JEFES',
     'MULTAS_FACTURACION',
     'OTROS'
   );

ALTER TABLE egresos_creditek_entradas
  ALTER COLUMN seccion SET DEFAULT 'ANTICIPOS';

ALTER TABLE egresos_creditek_entradas
  DROP CONSTRAINT IF EXISTS egresos_creditek_entradas_seccion_check;

ALTER TABLE egresos_creditek_entradas
  ADD CONSTRAINT egresos_creditek_entradas_seccion_check
  CHECK (seccion IN ('PRESTAMOS', 'ANTICIPOS'));

ALTER TABLE egresos_creditek_entradas
  DROP CONSTRAINT IF EXISTS egresos_creditek_entradas_tipo_check;

ALTER TABLE egresos_creditek_entradas
  ADD CONSTRAINT egresos_creditek_entradas_tipo_check
  CHECK (tipo IN (
    'ENTRADAS',
    'CAJAS',
    'TRANSFERENCIAS',
    'DESCUENTOS',
    'JEFES',
    'MULTAS_FACTURACION',
    'OTROS'
  ));

CREATE INDEX IF NOT EXISTS egresos_creditek_entradas_seccion_idx
  ON egresos_creditek_entradas (seccion);

CREATE INDEX IF NOT EXISTS egresos_creditek_entradas_tipo_idx
  ON egresos_creditek_entradas (tipo);

CREATE INDEX IF NOT EXISTS egresos_creditek_entradas_fecha_idx
  ON egresos_creditek_entradas (fecha);

-- Verificacion posterior
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'egresos_creditek_entradas'
  AND column_name IN ('seccion', 'tipo', 'fecha', 'observacion')
ORDER BY column_name;

SELECT seccion, tipo, COUNT(*) AS registros, SUM(valor) AS total
FROM egresos_creditek_entradas
GROUP BY seccion, tipo
ORDER BY seccion, tipo;

SELECT conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conname IN (
  'egresos_creditek_entradas_seccion_check',
  'egresos_creditek_entradas_tipo_check'
)
ORDER BY conname;
