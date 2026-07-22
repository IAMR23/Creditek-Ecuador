-- Verificacion previa de la estructura y estados existentes.
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'control_financiero_cargas'
  AND column_name IN ('estado', 'motivoAnulacion', 'anuladoPor', 'anuladoEn')
ORDER BY column_name;

ALTER TABLE control_financiero_cargas
  ADD COLUMN IF NOT EXISTS estado VARCHAR(20);

ALTER TABLE control_financiero_cargas
  ADD COLUMN IF NOT EXISTS "motivoAnulacion" TEXT;

ALTER TABLE control_financiero_cargas
  ADD COLUMN IF NOT EXISTS "anuladoPor" INTEGER;

ALTER TABLE control_financiero_cargas
  ADD COLUMN IF NOT EXISTS "anuladoEn" TIMESTAMP WITH TIME ZONE;

UPDATE control_financiero_cargas
SET estado = 'ACTIVA'
WHERE estado IS NULL;

ALTER TABLE control_financiero_cargas
  ALTER COLUMN estado SET DEFAULT 'ACTIVA';

ALTER TABLE control_financiero_cargas
  ALTER COLUMN estado SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'control_financiero_cargas_estado_chk'
      AND conrelid = 'control_financiero_cargas'::regclass
  ) THEN
    ALTER TABLE control_financiero_cargas
      ADD CONSTRAINT control_financiero_cargas_estado_chk
      CHECK (estado IN ('ACTIVA', 'ANULADA', 'REEMPLAZADA')) NOT VALID;
  END IF;
END $$;

ALTER TABLE control_financiero_cargas
  VALIDATE CONSTRAINT control_financiero_cargas_estado_chk;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'control_financiero_cargas_anulado_por_fk'
      AND conrelid = 'control_financiero_cargas'::regclass
  ) THEN
    ALTER TABLE control_financiero_cargas
      ADD CONSTRAINT control_financiero_cargas_anulado_por_fk
      FOREIGN KEY ("anuladoPor")
      REFERENCES usuarios(id)
      ON UPDATE CASCADE
      ON DELETE SET NULL
      NOT VALID;
  END IF;
END $$;

ALTER TABLE control_financiero_cargas
  VALIDATE CONSTRAINT control_financiero_cargas_anulado_por_fk;

CREATE INDEX IF NOT EXISTS control_financiero_cargas_estado_fecha_idx
ON control_financiero_cargas (estado, "fechaReporte" DESC);

-- Verificacion final: los datos historicos deben permanecer como ACTIVA.
SELECT estado, COUNT(*) AS cargas
FROM control_financiero_cargas
GROUP BY estado
ORDER BY estado;
