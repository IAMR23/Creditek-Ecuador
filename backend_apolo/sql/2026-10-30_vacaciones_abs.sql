-- ABS: módulo auditable de vacaciones. Ejecutar primero en un ambiente de prueba.
BEGIN;

-- Verificación previa (informativa)
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name LIKE 'vacacion_%'
ORDER BY table_name;

CREATE TABLE IF NOT EXISTS vacacion_periodos (
  id SERIAL PRIMARY KEY,
  "usuarioId" INTEGER NOT NULL REFERENCES usuarios(id),
  "fechaInicio" DATE NOT NULL,
  "fechaFin" DATE NOT NULL,
  estado VARCHAR(20) NOT NULL CHECK (estado IN ('CUMPLIDO', 'FORMACION')),
  "fechaCorte" DATE NOT NULL,
  observacion TEXT,
  "creadoPorId" INTEGER NOT NULL REFERENCES usuarios(id),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT vacacion_periodos_fechas_ck CHECK ("fechaFin" >= "fechaInicio"),
  CONSTRAINT vacacion_periodos_usuario_rango_uq UNIQUE ("usuarioId", "fechaInicio", "fechaFin")
);

CREATE TABLE IF NOT EXISTS vacacion_solicitudes (
  id BIGSERIAL PRIMARY KEY,
  "usuarioId" INTEGER NOT NULL REFERENCES usuarios(id),
  "agenciaId" INTEGER NOT NULL REFERENCES agencias(id),
  "cantidadDias" NUMERIC(8,2) NOT NULL CHECK ("cantidadDias" > 0),
  "fechaInicio" DATE NOT NULL,
  "fechaFin" DATE NOT NULL,
  "fechaReincorporacion" DATE NOT NULL,
  observacion TEXT,
  "reemplazoUsuarioId" INTEGER REFERENCES usuarios(id),
  estado VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE' CHECK (estado IN ('PENDIENTE','APROBADA','RECHAZADA','CANCELADA')),
  "motivoPrioridad" TEXT,
  "motivoDecision" TEXT,
  "autorId" INTEGER NOT NULL REFERENCES usuarios(id),
  "aprobadorId" INTEGER REFERENCES usuarios(id),
  "fechaAprobacion" TIMESTAMPTZ,
  "fechaDecision" TIMESTAMPTZ,
  "idempotenciaKey" VARCHAR(100) UNIQUE,
  version INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT vacacion_solicitudes_fechas_ck CHECK ("fechaFin" >= "fechaInicio" AND "fechaReincorporacion" > "fechaFin")
);

CREATE TABLE IF NOT EXISTS vacacion_movimientos (
  id BIGSERIAL PRIMARY KEY,
  "periodoId" INTEGER NOT NULL REFERENCES vacacion_periodos(id),
  categoria VARCHAR(30) NOT NULL CHECK (categoria IN ('RECONOCIDO_ORDINARIO','RECONOCIDO_ADICIONAL','DISFRUTADO','COMPROMETIDO','RESERVADO_COMPENSACION','COMPENSADO')),
  dias NUMERIC(8,2) NOT NULL CHECK (dias <> 0),
  motivo TEXT NOT NULL,
  "fechaEfectiva" DATE NOT NULL,
  "origenTipo" VARCHAR(30) NOT NULL,
  "origenId" VARCHAR(80) NOT NULL,
  "creadoPorId" INTEGER NOT NULL REFERENCES usuarios(id),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS vacacion_movimientos_origen_uq
  ON vacacion_movimientos ("periodoId", categoria, "origenTipo", "origenId");
CREATE INDEX IF NOT EXISTS vacacion_movimientos_periodo_categoria_idx
  ON vacacion_movimientos ("periodoId", categoria);

CREATE TABLE IF NOT EXISTS vacacion_solicitud_periodos (
  id BIGSERIAL PRIMARY KEY,
  "solicitudId" BIGINT NOT NULL REFERENCES vacacion_solicitudes(id),
  "periodoId" INTEGER NOT NULL REFERENCES vacacion_periodos(id),
  dias NUMERIC(8,2) NOT NULL CHECK (dias > 0),
  orden INTEGER NOT NULL CHECK (orden > 0),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT vacacion_solicitud_periodos_uq UNIQUE ("solicitudId", "periodoId")
);

CREATE TABLE IF NOT EXISTS vacacion_historial (
  id BIGSERIAL PRIMARY KEY,
  "solicitudId" BIGINT NOT NULL REFERENCES vacacion_solicitudes(id),
  accion VARCHAR(40) NOT NULL,
  "estadoAnterior" VARCHAR(20),
  "estadoNuevo" VARCHAR(20) NOT NULL,
  motivo TEXT,
  datos JSONB,
  "actorId" INTEGER NOT NULL REFERENCES usuarios(id),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vacacion_pagos (
  id BIGSERIAL PRIMARY KEY,
  "usuarioId" INTEGER NOT NULL REFERENCES usuarios(id),
  concepto VARCHAR(40) NOT NULL CHECK (concepto IN ('REMUNERACION_DESCANSO','COMPENSACION_ANTIGUEDAD','LIQUIDACION_TERMINACION','HISTORICO_REVISION')),
  fundamento TEXT NOT NULL,
  dias NUMERIC(8,2) NOT NULL DEFAULT 0 CHECK (dias >= 0),
  "baseCalculo" NUMERIC(14,2),
  monto NUMERIC(14,2) NOT NULL CHECK (monto >= 0),
  "fechaPago" DATE,
  medio VARCHAR(80),
  referencia VARCHAR(120),
  soporte TEXT,
  estado VARCHAR(30) NOT NULL DEFAULT 'PENDIENTE_PAGO' CHECK (estado IN ('PENDIENTE_PAGO','PAGADO','ANULADO')),
  "autorId" INTEGER NOT NULL REFERENCES usuarios(id),
  "aprobadorId" INTEGER REFERENCES usuarios(id),
  "pagadorId" INTEGER REFERENCES usuarios(id),
  "fechaAprobacion" TIMESTAMPTZ,
  "idempotenciaKey" VARCHAR(100) UNIQUE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vacacion_pago_periodos (
  id BIGSERIAL PRIMARY KEY,
  "pagoId" BIGINT NOT NULL REFERENCES vacacion_pagos(id),
  "periodoId" INTEGER NOT NULL REFERENCES vacacion_periodos(id),
  dias NUMERIC(8,2) NOT NULL CHECK (dias > 0),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT vacacion_pago_periodos_uq UNIQUE ("pagoId", "periodoId")
);

CREATE INDEX IF NOT EXISTS vacacion_solicitudes_usuario_fechas_idx
  ON vacacion_solicitudes ("usuarioId", "fechaInicio", "fechaFin");
CREATE INDEX IF NOT EXISTS vacacion_solicitudes_agencia_estado_idx
  ON vacacion_solicitudes ("agenciaId", estado);

COMMIT;

-- Verificación posterior
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name LIKE 'vacacion_%'
ORDER BY table_name;
SELECT indexname FROM pg_indexes
WHERE schemaname = 'public' AND tablename LIKE 'vacacion_%'
ORDER BY tablename, indexname;
