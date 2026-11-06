CREATE TABLE IF NOT EXISTS roles_pago_juniors (
  id SERIAL PRIMARY KEY,
  "cargoRolPagoId" INTEGER NOT NULL
    REFERENCES roles_pago(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  "juniorRolPagoId" INTEGER NOT NULL
    REFERENCES roles_pago(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT roles_pago_juniors_cargos_distintos
    CHECK ("cargoRolPagoId" <> "juniorRolPagoId")
);

CREATE UNIQUE INDEX IF NOT EXISTS roles_pago_juniors_cargo_junior_unique
  ON roles_pago_juniors ("cargoRolPagoId", "juniorRolPagoId");

CREATE INDEX IF NOT EXISTS roles_pago_juniors_activo_idx
  ON roles_pago_juniors (activo);
