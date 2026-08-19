-- Verificacion previa:
-- SELECT to_regclass('public.facturas_fisicas') AS tabla_existente;
--
-- Si tabla_existente no es NULL, detener la ejecucion y analizar la tabla
-- existente antes de aplicar cualquier cambio.

DO $$
BEGIN
  IF to_regclass('public.facturas_fisicas') IS NOT NULL THEN
    RAISE EXCEPTION 'La tabla facturas_fisicas ya existe. Revisar antes de modificarla.';
  END IF;
END $$;

CREATE TABLE facturas_fisicas (
  id SERIAL PRIMARY KEY,
  "nombreArchivoOriginal" VARCHAR(255) NOT NULL,
  "nombreArchivoGuardado" VARCHAR(255) NOT NULL,
  "mimeType" VARCHAR(120) NOT NULL,
  extension VARCHAR(12) NOT NULL,
  "sizeBytes" BIGINT NOT NULL,
  sha256 VARCHAR(64) NOT NULL,
  "rutaArchivo" TEXT NOT NULL,
  estado VARCHAR(30) NOT NULL DEFAULT 'CARGADA',
  "origenCarga" VARCHAR(30) NOT NULL DEFAULT 'WEB',
  "usuarioCargaId" INTEGER NOT NULL REFERENCES usuarios(id),
  proveedor VARCHAR(255),
  "rucProveedor" VARCHAR(30),
  "numeroFactura" VARCHAR(80),
  "fechaEmision" DATE,
  subtotal DECIMAL(14, 2),
  impuestos DECIMAL(14, 2),
  total DECIMAL(14, 2),
  observacion TEXT,
  "datosAdicionales" JSONB,
  "motivoAnulacion" TEXT,
  "anuladoPorId" INTEGER REFERENCES usuarios(id),
  "anuladoEn" TIMESTAMP WITH TIME ZONE,
  "creadoPorId" INTEGER NOT NULL REFERENCES usuarios(id),
  "actualizadoPorId" INTEGER REFERENCES usuarios(id),
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT facturas_fisicas_estado_check CHECK (
    estado IN (
      'CARGADA',
      'PENDIENTE_REVISION',
      'REVISADA',
      'CONFIRMADA',
      'ANULADA',
      'ERROR'
    )
  )
);

CREATE INDEX facturas_fisicas_sha256_idx ON facturas_fisicas (sha256);
CREATE INDEX facturas_fisicas_estado_idx ON facturas_fisicas (estado);
CREATE INDEX facturas_fisicas_created_at_idx ON facturas_fisicas ("createdAt");
CREATE INDEX facturas_fisicas_usuario_carga_idx
  ON facturas_fisicas ("usuarioCargaId");
CREATE INDEX facturas_fisicas_ruc_proveedor_idx
  ON facturas_fisicas ("rucProveedor");
CREATE INDEX facturas_fisicas_numero_factura_idx
  ON facturas_fisicas ("numeroFactura");

-- Validacion final:
-- SELECT id, estado, sha256, "createdAt" FROM facturas_fisicas LIMIT 5;
