-- Agrega la gestion persistente de las entradas de Ventas TV y Ventas Celular.
ALTER TABLE control_financiero_registros
  ADD COLUMN IF NOT EXISTS "estadoPagoEntrada" VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE',
  ADD COLUMN IF NOT EXISTS "responsablePagoEntradaId" INTEGER,
  ADD COLUMN IF NOT EXISTS "observacionPagoEntrada" TEXT;

UPDATE control_financiero_registros
SET "estadoPagoEntrada" = 'PENDIENTE'
WHERE "estadoPagoEntrada" IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'control_financiero_registros_estado_pago_entrada_check'
  ) THEN
    ALTER TABLE control_financiero_registros
      ADD CONSTRAINT control_financiero_registros_estado_pago_entrada_check
      CHECK ("estadoPagoEntrada" IN ('PENDIENTE', 'PAGADO'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'control_financiero_registros'::regclass
      AND contype = 'f'
      AND pg_get_constraintdef(oid) LIKE '%("responsablePagoEntradaId")%'
  ) THEN
    ALTER TABLE control_financiero_registros
      ADD CONSTRAINT control_financiero_registros_responsable_pago_entrada_fkey
      FOREIGN KEY ("responsablePagoEntradaId") REFERENCES usuarios(id)
      ON UPDATE CASCADE ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS control_financiero_registros_estado_pago_entrada_idx
  ON control_financiero_registros ("estadoPagoEntrada");

CREATE INDEX IF NOT EXISTS control_financiero_registros_responsable_pago_entrada_idx
  ON control_financiero_registros ("responsablePagoEntradaId");

SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'control_financiero_registros'
  AND column_name IN (
    'estadoPagoEntrada',
    'responsablePagoEntradaId',
    'observacionPagoEntrada'
  )
ORDER BY ordinal_position;
