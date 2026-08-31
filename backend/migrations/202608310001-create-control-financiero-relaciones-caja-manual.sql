BEGIN;

SELECT
  to_regclass('public.control_financiero_relaciones_caja_manual')
    AS tabla_relaciones_caja_manual_antes;

CREATE TABLE IF NOT EXISTS control_financiero_relaciones_caja_manual (
  id BIGSERIAL PRIMARY KEY,
  "cargaId" INTEGER NOT NULL
    REFERENCES control_financiero_cargas(id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  "registroReporteId" INTEGER NOT NULL
    REFERENCES control_financiero_registros(id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  "movimientoCajaId" INTEGER NOT NULL
    REFERENCES movimientos_caja(id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  "tipoRelacion" VARCHAR(20) NOT NULL DEFAULT 'MANUAL',
  observacion TEXT NULL,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  "relacionadoPor" INTEGER NOT NULL
    REFERENCES usuarios(id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  "relacionadoEn" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "deshechoPor" INTEGER NULL
    REFERENCES usuarios(id)
    ON UPDATE CASCADE
    ON DELETE SET NULL,
  "deshechoEn" TIMESTAMPTZ NULL,
  "motivoDeshacer" TEXT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT control_financiero_relaciones_caja_manual_tipo_chk
    CHECK ("tipoRelacion" = 'MANUAL')
);

CREATE INDEX IF NOT EXISTS control_financiero_relaciones_caja_manual_carga_idx
ON control_financiero_relaciones_caja_manual ("cargaId", activo);

CREATE INDEX IF NOT EXISTS control_financiero_relaciones_caja_manual_registro_idx
ON control_financiero_relaciones_caja_manual ("registroReporteId");

CREATE INDEX IF NOT EXISTS control_financiero_relaciones_caja_manual_movimiento_idx
ON control_financiero_relaciones_caja_manual ("movimientoCajaId");

CREATE UNIQUE INDEX IF NOT EXISTS control_financiero_relaciones_caja_manual_registro_activo_unique
ON control_financiero_relaciones_caja_manual ("registroReporteId")
WHERE activo IS TRUE;

CREATE UNIQUE INDEX IF NOT EXISTS control_financiero_relaciones_caja_manual_movimiento_activo_unique
ON control_financiero_relaciones_caja_manual ("movimientoCajaId")
WHERE activo IS TRUE;

SELECT
  to_regclass('public.control_financiero_relaciones_caja_manual')
    AS tabla_relaciones_caja_manual_despues,
  COUNT(*) AS relaciones_existentes
FROM control_financiero_relaciones_caja_manual;

COMMIT;
