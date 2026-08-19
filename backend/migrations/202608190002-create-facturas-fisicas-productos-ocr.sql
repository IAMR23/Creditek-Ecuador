-- Verificacion previa:
-- SELECT to_regclass('public.facturas_fisicas_productos_ocr') AS tabla_existente;

CREATE TABLE IF NOT EXISTS facturas_fisicas_productos_ocr (
  id SERIAL PRIMARY KEY,
  "facturaFisicaId" INTEGER NOT NULL REFERENCES facturas_fisicas(id),
  descripcion VARCHAR(500) NOT NULL,
  cantidad DECIMAL(14, 3),
  "precioUnitario" DECIMAL(14, 2),
  descuento DECIMAL(14, 2),
  "totalLinea" DECIMAL(14, 2),
  codigo VARCHAR(80),
  advertencias JSONB NOT NULL DEFAULT '[]'::jsonb,
  orden INTEGER NOT NULL,
  estado VARCHAR(20) NOT NULL DEFAULT 'DETECTADO',
  "loteOcr" UUID NOT NULL,
  "versionOcr" INTEGER NOT NULL,
  "esResultadoActual" BOOLEAN NOT NULL DEFAULT TRUE,
  "editadoManualmente" BOOLEAN NOT NULL DEFAULT FALSE,
  "detectadoPorId" INTEGER NOT NULL REFERENCES usuarios(id),
  "actualizadoPorId" INTEGER REFERENCES usuarios(id),
  "confirmadoPorId" INTEGER REFERENCES usuarios(id),
  "confirmadoEn" TIMESTAMP WITH TIME ZONE,
  "descartadoPorId" INTEGER REFERENCES usuarios(id),
  "descartadoEn" TIMESTAMP WITH TIME ZONE,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'facturas_fisicas_productos_ocr_estado_check'
      AND conrelid = 'public.facturas_fisicas_productos_ocr'::regclass
  ) THEN
    ALTER TABLE facturas_fisicas_productos_ocr
      ADD CONSTRAINT facturas_fisicas_productos_ocr_estado_check
      CHECK (estado IN ('DETECTADO', 'CONFIRMADO', 'DESCARTADO'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS facturas_fisicas_productos_ocr_factura_idx
  ON facturas_fisicas_productos_ocr ("facturaFisicaId");
CREATE INDEX IF NOT EXISTS facturas_fisicas_productos_ocr_estado_idx
  ON facturas_fisicas_productos_ocr (estado);
CREATE INDEX IF NOT EXISTS facturas_fisicas_productos_ocr_lote_idx
  ON facturas_fisicas_productos_ocr ("loteOcr");
CREATE INDEX IF NOT EXISTS facturas_fisicas_productos_ocr_actual_idx
  ON facturas_fisicas_productos_ocr (
    "facturaFisicaId",
    "esResultadoActual",
    orden
  );

-- Validacion final:
-- SELECT column_name, data_type
-- FROM information_schema.columns
-- WHERE table_schema = 'public'
--   AND table_name = 'facturas_fisicas_productos_ocr'
-- ORDER BY ordinal_position;
