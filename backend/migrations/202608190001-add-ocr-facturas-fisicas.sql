-- Verificacion previa:
-- SELECT column_name, data_type
-- FROM information_schema.columns
-- WHERE table_schema = 'public' AND table_name = 'facturas_fisicas'
-- ORDER BY ordinal_position;

ALTER TABLE facturas_fisicas
  ADD COLUMN IF NOT EXISTS "ocrEstado" VARCHAR(40) NOT NULL DEFAULT 'NO_PROCESADO',
  ADD COLUMN IF NOT EXISTS "ocrTexto" TEXT,
  ADD COLUMN IF NOT EXISTS "ocrCampos" JSONB,
  ADD COLUMN IF NOT EXISTS "ocrAdvertencias" JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS "ocrMetadata" JSONB,
  ADD COLUMN IF NOT EXISTS "ocrError" TEXT,
  ADD COLUMN IF NOT EXISTS "ocrProcesadoEn" TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS "ocrProcesadoPorId" INTEGER,
  ADD COLUMN IF NOT EXISTS "ocrMotor" VARCHAR(80),
  ADD COLUMN IF NOT EXISTS "ocrVersion" VARCHAR(40),
  ADD COLUMN IF NOT EXISTS "ocrHistorial" JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS "ocrProcesamientoToken" UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'facturas_fisicas_ocr_estado_check'
      AND conrelid = 'public.facturas_fisicas'::regclass
  ) THEN
    ALTER TABLE facturas_fisicas
      ADD CONSTRAINT facturas_fisicas_ocr_estado_check CHECK (
        "ocrEstado" IN (
          'NO_PROCESADO',
          'PROCESANDO',
          'PROCESADO',
          'PROCESADO_CON_ADVERTENCIAS',
          'ERROR'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint AS constraint_info
    JOIN LATERAL unnest(constraint_info.conkey) AS key_column(attnum)
      ON TRUE
    JOIN pg_attribute AS attribute_info
      ON attribute_info.attrelid = constraint_info.conrelid
     AND attribute_info.attnum = key_column.attnum
    WHERE constraint_info.contype = 'f'
      AND constraint_info.conrelid = 'public.facturas_fisicas'::regclass
      AND attribute_info.attname = 'ocrProcesadoPorId'
  ) THEN
    ALTER TABLE facturas_fisicas
      ADD CONSTRAINT facturas_fisicas_ocr_procesado_por_fk
      FOREIGN KEY ("ocrProcesadoPorId") REFERENCES usuarios(id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS facturas_fisicas_ocr_estado_idx
  ON facturas_fisicas ("ocrEstado");
CREATE INDEX IF NOT EXISTS facturas_fisicas_ocr_procesado_por_idx
  ON facturas_fisicas ("ocrProcesadoPorId");

-- Validacion final:
-- SELECT id, "ocrEstado", "ocrProcesadoEn", "ocrProcesadoPorId"
-- FROM facturas_fisicas
-- ORDER BY id DESC
-- LIMIT 10;
