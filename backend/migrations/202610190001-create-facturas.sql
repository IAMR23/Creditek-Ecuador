-- Verificacion previa segura:
SELECT to_regclass('public.facturas') AS tabla_existente;

CREATE TABLE IF NOT EXISTS facturas (
  id SERIAL PRIMARY KEY,
  "fechaFactura" DATE NULL,
  proveedor VARCHAR(255) NULL,
  "identificacionProveedor" VARCHAR(30) NULL,
  "numeroFactura" VARCHAR(100) NULL,
  subtotal DECIMAL(14, 2) NULL CHECK (subtotal >= 0),
  iva DECIMAL(14, 2) NULL CHECK (iva >= 0),
  total DECIMAL(14, 2) NULL CHECK (total >= 0),
  "formaPago" VARCHAR(120) NULL,
  estado VARCHAR(80) NULL,
  "enlaceFoto" TEXT,
  observaciones TEXT,
  tipo VARCHAR(100) NULL,
  "nombreArchivoJson" VARCHAR(255) NULL,
  "payloadOriginal" JSONB NULL CHECK (jsonb_typeof("payloadOriginal") = 'object'),
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS facturas_fecha_factura_idx
  ON facturas ("fechaFactura" DESC);
CREATE INDEX IF NOT EXISTS facturas_fecha_carga_idx
  ON facturas ("createdAt" DESC);
CREATE INDEX IF NOT EXISTS facturas_proveedor_idx
  ON facturas (proveedor);
CREATE INDEX IF NOT EXISTS facturas_identificacion_numero_idx
  ON facturas ("identificacionProveedor", "numeroFactura");
CREATE UNIQUE INDEX IF NOT EXISTS facturas_numero_factura_unique
  ON facturas ("numeroFactura");
CREATE INDEX IF NOT EXISTS facturas_estado_idx
  ON facturas (estado);
CREATE INDEX IF NOT EXISTS facturas_tipo_idx
  ON facturas (tipo);

-- Validacion final:
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'facturas'
ORDER BY ordinal_position;

SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'facturas'
ORDER BY indexname;
