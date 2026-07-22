-- Verificacion previa: ambas tablas deben ser nuevas en la primera ejecucion.
SELECT
  to_regclass('public.control_financiero_cargas') AS tabla_cargas,
  to_regclass('public.control_financiero_registros') AS tabla_registros;

CREATE TABLE IF NOT EXISTS control_financiero_cargas (
  id SERIAL PRIMARY KEY,
  "archivoGenerado" VARCHAR(255) NOT NULL,
  "fechaReporte" DATE,
  estado VARCHAR(20) NOT NULL DEFAULT 'ACTIVA'
    CHECK (estado IN ('ACTIVA', 'ANULADA', 'REEMPLAZADA')),
  "motivoAnulacion" TEXT,
  "anuladoPor" INTEGER REFERENCES usuarios(id)
    ON UPDATE CASCADE ON DELETE SET NULL,
  "anuladoEn" TIMESTAMP WITH TIME ZONE,
  "registrosCaja" INTEGER NOT NULL DEFAULT 0 CHECK ("registrosCaja" >= 0),
  "registrosVentasTv" INTEGER NOT NULL DEFAULT 0 CHECK ("registrosVentasTv" >= 0),
  "registrosVentasCelular" INTEGER NOT NULL DEFAULT 0 CHECK ("registrosVentasCelular" >= 0),
  "totalPagosCaja" NUMERIC(14, 2) NOT NULL DEFAULT 0,
  "totalVentasTv" NUMERIC(14, 2) NOT NULL DEFAULT 0,
  "totalEntradasTv" NUMERIC(14, 2) NOT NULL DEFAULT 0,
  "totalVentasCelular" NUMERIC(14, 2) NOT NULL DEFAULT 0,
  "totalEntradasCelular" NUMERIC(14, 2) NOT NULL DEFAULT 0,
  "usuarioId" INTEGER REFERENCES usuarios(id) ON UPDATE CASCADE ON DELETE SET NULL,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS control_financiero_registros (
  id SERIAL PRIMARY KEY,
  "cargaId" INTEGER NOT NULL REFERENCES control_financiero_cargas(id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  "tipoRegistro" VARCHAR(30) NOT NULL
    CHECK ("tipoRegistro" IN ('CAJA', 'VENTA_TV', 'VENTA_CELULAR')),
  contrato VARCHAR(80),
  fecha VARCHAR(80),
  vendedor VARCHAR(160),
  "usuarioCobrador" VARCHAR(120),
  cliente VARCHAR(255),
  modelo VARCHAR(255),
  imei VARCHAR(80),
  "pagosCuotas" NUMERIC(14, 2) NOT NULL DEFAULT 0,
  "numeroCuotas" VARCHAR(100),
  ventas NUMERIC(14, 2) NOT NULL DEFAULT 0,
  entradas NUMERIC(14, 2) NOT NULL DEFAULT 0,
  producto VARCHAR(40),
  agencia VARCHAR(120),
  "archivoOrigen" VARCHAR(255),
  "archivoHash" VARCHAR(64),
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS control_financiero_cargas_fecha_idx
ON control_financiero_cargas ("createdAt" DESC);

CREATE INDEX IF NOT EXISTS control_financiero_cargas_fecha_reporte_idx
ON control_financiero_cargas ("fechaReporte" DESC);

CREATE INDEX IF NOT EXISTS control_financiero_cargas_estado_fecha_idx
ON control_financiero_cargas (estado, "fechaReporte" DESC);

CREATE INDEX IF NOT EXISTS control_financiero_cargas_usuario_idx
ON control_financiero_cargas ("usuarioId");

CREATE INDEX IF NOT EXISTS control_financiero_registros_carga_tipo_idx
ON control_financiero_registros ("cargaId", "tipoRegistro");

CREATE INDEX IF NOT EXISTS control_financiero_registros_contrato_idx
ON control_financiero_registros (contrato);

CREATE INDEX IF NOT EXISTS control_financiero_registros_carga_archivo_hash_idx
ON control_financiero_registros ("cargaId", "archivoHash");

-- Verificacion posterior: estructura creada sin modificar datos historicos.
SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name IN ('control_financiero_cargas', 'control_financiero_registros')
ORDER BY table_name, ordinal_position;
