-- Verificacion previa segura:
SELECT to_regclass('public.facturas_ia_resultados') AS tabla_existente;

CREATE TABLE IF NOT EXISTS facturas_ia_resultados (
  id SERIAL PRIMARY KEY,
  "grupoComparacion" VARCHAR(160) NOT NULL,
  "nombreArchivoJson" VARCHAR(255) NOT NULL,
  sha256 VARCHAR(64) NOT NULL,
  proveedor VARCHAR(255),
  "rucProveedor" VARCHAR(30),
  "numeroFactura" VARCHAR(80),
  "fechaEmision" DATE,
  subtotal DECIMAL(18, 6),
  impuestos DECIMAL(18, 6),
  total DECIMAL(18, 6),
  "totalProductosCalculado" DECIMAL(18, 6),
  "diferenciaProductosSubtotal" DECIMAL(18, 6),
  "diferenciaSubtotalImpuestosTotal" DECIMAL(18, 6),
  "cantidadProductos" INTEGER NOT NULL DEFAULT 0 CHECK ("cantidadProductos" >= 0),
  puntaje DECIMAL(5, 2) NOT NULL DEFAULT 0 CHECK (puntaje >= 0 AND puntaje <= 100),
  "esSeleccionada" BOOLEAN NOT NULL DEFAULT FALSE,
  "payloadOriginal" JSONB NOT NULL CHECK (jsonb_typeof("payloadOriginal") = 'object'),
  "payloadNormalizado" JSONB NOT NULL CHECK (jsonb_typeof("payloadNormalizado") = 'object'),
  advertencias JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(advertencias) = 'array'),
  "creadoPorId" INTEGER NOT NULL REFERENCES usuarios(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  "seleccionadoPorId" INTEGER REFERENCES usuarios(id)
    ON UPDATE CASCADE ON DELETE SET NULL,
  "seleccionadoEn" TIMESTAMP WITH TIME ZONE,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS facturas_ia_grupo_idx
  ON facturas_ia_resultados ("grupoComparacion");
CREATE INDEX IF NOT EXISTS facturas_ia_seleccion_idx
  ON facturas_ia_resultados ("esSeleccionada");
CREATE INDEX IF NOT EXISTS facturas_ia_creacion_idx
  ON facturas_ia_resultados ("createdAt" DESC);
CREATE INDEX IF NOT EXISTS facturas_ia_ruc_numero_idx
  ON facturas_ia_resultados ("rucProveedor", "numeroFactura");
CREATE INDEX IF NOT EXISTS facturas_ia_puntaje_idx
  ON facturas_ia_resultados (puntaje DESC);

-- Validacion final:
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'facturas_ia_resultados'
ORDER BY ordinal_position;

SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'facturas_ia_resultados'
ORDER BY indexname;
