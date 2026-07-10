CREATE TABLE IF NOT EXISTS sanciones_configuracion (
  id SERIAL PRIMARY KEY,
  "rolPagoId" INTEGER NULL REFERENCES roles_pago(id) ON UPDATE CASCADE ON DELETE SET NULL,
  "cargoReferencia" VARCHAR(255) NOT NULL,
  periodo VARCHAR(20) NOT NULL CHECK (periodo IN ('SEMANAL', 'MENSUAL', 'RANGO')),
  "minimoUnidades" INTEGER NOT NULL CHECK ("minimoUnidades" >= 0),
  "valorMultaUnidad" DECIMAL(10,2) NOT NULL CHECK ("valorMultaUnidad" >= 0),
  descripcion TEXT NULL,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE ("cargoReferencia", periodo)
);
CREATE INDEX IF NOT EXISTS sanciones_configuracion_rol_pago_idx ON sanciones_configuracion ("rolPagoId");
CREATE INDEX IF NOT EXISTS sanciones_configuracion_activo_idx ON sanciones_configuracion (activo);
SELECT id, "cargoReferencia", periodo, "minimoUnidades", "valorMultaUnidad", activo FROM sanciones_configuracion ORDER BY id;
