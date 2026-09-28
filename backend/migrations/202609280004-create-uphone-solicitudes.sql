-- Almacen incremental de solicitudes Uphone. La unicidad del numero evita
-- duplicados incluso cuando dos importaciones se ejecutan al mismo tiempo.
CREATE TABLE IF NOT EXISTS uphone_solicitudes (
  id BIGSERIAL PRIMARY KEY,
  "numeroSolicitud" VARCHAR(40) NOT NULL,
  distribuidor VARCHAR(180),
  matriz VARCHAR(180),
  vendedor VARCHAR(220),
  usuario VARCHAR(100),
  cedula VARCHAR(30),
  cliente VARCHAR(220),
  "telefonoSolicitud" VARCHAR(30),
  "telefonoContrato" VARCHAR(30),
  "fechaSolicitud" TIMESTAMPTZ,
  "fechaContrato" VARCHAR(40),
  "grupoArrendamiento" VARCHAR(160),
  estado VARCHAR(80),
  "estadoContrato" VARCHAR(120),
  "archivoOrigen" VARCHAR(255) NOT NULL,
  "importadoPorId" INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uphone_solicitudes_numero_solicitud_unique
  ON uphone_solicitudes ("numeroSolicitud");
CREATE INDEX IF NOT EXISTS uphone_solicitudes_fecha_idx
  ON uphone_solicitudes ("fechaSolicitud" DESC);
CREATE INDEX IF NOT EXISTS uphone_solicitudes_estado_idx
  ON uphone_solicitudes (estado);
CREATE INDEX IF NOT EXISTS uphone_solicitudes_vendedor_idx
  ON uphone_solicitudes (vendedor);
CREATE INDEX IF NOT EXISTS uphone_solicitudes_created_at_idx
  ON uphone_solicitudes ("createdAt" DESC);

-- Verificacion previa/posterior sugerida:
-- SELECT COUNT(*) AS total, COUNT(DISTINCT "numeroSolicitud") AS unicas
-- FROM uphone_solicitudes;
-- No se incluye DROP de reversa para proteger el historial importado.
