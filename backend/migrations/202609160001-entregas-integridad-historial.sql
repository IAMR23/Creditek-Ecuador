-- RVE: integridad e historial de entregas.
-- Etapa 1: prepara versionado, historial y reconciliacion. No corrige datos.

BEGIN;

ALTER TABLE entregas
  ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 0;

ALTER TABLE usuario_agencia_entrega
  ADD COLUMN IF NOT EXISTS fecha_desasignacion TIMESTAMP WITHOUT TIME ZONE;

COMMENT ON COLUMN usuario_agencia_entrega.fecha_desasignacion IS
  'Fin de vigencia por cambio de responsable o desactivacion de relacion.';
COMMENT ON COLUMN usuario_agencia_entrega.fecha_finalizacion IS
  'Fecha en que la entrega alcanzo un estado operativo final.';

ALTER TABLE usuario_agencia_entrega
  DROP CONSTRAINT IF EXISTS usuario_agencia_entrega_usuario_agencia_id_entrega_id_key;
DROP INDEX IF EXISTS usuario_agencia_entrega_usuario_agencia_id_entrega_id;

CREATE INDEX IF NOT EXISTS usuario_agencia_entrega_usuario_entrega_idx
  ON usuario_agencia_entrega (usuario_agencia_id, entrega_id);

CREATE TABLE IF NOT EXISTS entrega_eventos (
  id BIGSERIAL PRIMARY KEY,
  "entregaId" INTEGER NOT NULL REFERENCES entregas(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  tipo VARCHAR(40) NOT NULL,
  "estadoAnterior" VARCHAR(255),
  "estadoNuevo" VARCHAR(255),
  "usuarioAgenciaAnteriorId" INTEGER REFERENCES usuario_agencia(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  "usuarioAgenciaNuevoId" INTEGER REFERENCES usuario_agencia(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  "actorUsuarioId" INTEGER NOT NULL REFERENCES usuarios(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  motivo TEXT NOT NULL,
  "idempotencyKey" VARCHAR(160),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS entrega_eventos_idempotency_key_unique
  ON entrega_eventos ("idempotencyKey")
  WHERE "idempotencyKey" IS NOT NULL;
CREATE INDEX IF NOT EXISTS entrega_eventos_entrega_fecha_idx
  ON entrega_eventos ("entregaId", "createdAt");

CREATE TABLE IF NOT EXISTS entrega_reconciliaciones (
  id BIGSERIAL PRIMARY KEY,
  "reconciliacionId" UUID NOT NULL,
  "entregaId" INTEGER NOT NULL REFERENCES entregas(id) ON DELETE RESTRICT,
  "asignacionAnteriorId" INTEGER REFERENCES usuario_agencia_entrega(id) ON DELETE RESTRICT,
  "asignacionesAnteriores" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "asignacionNuevaId" INTEGER REFERENCES usuario_agencia_entrega(id) ON DELETE RESTRICT,
  "estadoAnterior" VARCHAR(255),
  "estadoNuevo" VARCHAR(255),
  "versionAnterior" INTEGER NOT NULL,
  "versionNueva" INTEGER NOT NULL,
  "actorUsuarioId" INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  motivo TEXT NOT NULL,
  revertida BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "revertedAt" TIMESTAMPTZ,
  UNIQUE ("reconciliacionId", "entregaId")
);

COMMIT;

-- A continuacion: ejecutar reconciliacion en dry-run y luego aplicar
-- 202609160002-entregas-asignacion-activa-unica.sql.
