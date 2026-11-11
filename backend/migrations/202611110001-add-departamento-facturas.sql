-- Verificacion previa segura.
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'facturas'
  AND column_name = 'departamento';

ALTER TABLE facturas
  ADD COLUMN IF NOT EXISTS departamento VARCHAR(20);

-- En la primera ejecucion todas las facturas existentes quedan en Logistica.
-- La condicion evita sobrescribir asignaciones si el archivo se repite.
UPDATE facturas
SET departamento = 'LOGISTICA'
WHERE departamento IS NULL;

ALTER TABLE facturas
  ALTER COLUMN departamento SET DEFAULT 'LOGISTICA',
  ALTER COLUMN departamento SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'facturas_departamento_check'
      AND conrelid = 'facturas'::regclass
  ) THEN
    ALTER TABLE facturas
      ADD CONSTRAINT facturas_departamento_check
      CHECK (departamento IN ('LOGISTICA', 'COMERCIAL', 'SISTEMAS'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS facturas_departamento_idx
  ON facturas (departamento);

-- Validacion final.
SELECT departamento, COUNT(*) AS total
FROM facturas
GROUP BY departamento
ORDER BY departamento;

SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'facturas'
  AND column_name = 'departamento';
