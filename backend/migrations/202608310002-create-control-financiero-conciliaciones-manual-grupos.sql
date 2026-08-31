BEGIN;

CREATE TABLE IF NOT EXISTS control_financiero_conciliaciones_manual (
  id BIGSERIAL PRIMARY KEY,
  "cargaId" INTEGER NOT NULL REFERENCES control_financiero_cargas(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  observacion TEXT NULL,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  "relacionadoPor" INTEGER NOT NULL REFERENCES usuarios(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  "relacionadoEn" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "deshechoPor" INTEGER NULL REFERENCES usuarios(id) ON UPDATE CASCADE ON DELETE SET NULL,
  "deshechoEn" TIMESTAMPTZ NULL,
  "motivoDeshacer" TEXT NULL,
  "relacionAnteriorId" BIGINT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE control_financiero_conciliaciones_manual
ADD COLUMN IF NOT EXISTS "relacionAnteriorId" BIGINT NULL;

CREATE TABLE IF NOT EXISTS control_financiero_conciliaciones_manual_detalle (
  id BIGSERIAL PRIMARY KEY,
  "conciliacionManualId" BIGINT NOT NULL REFERENCES control_financiero_conciliaciones_manual(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  tipo VARCHAR(10) NOT NULL,
  "registroReporteId" INTEGER NULL REFERENCES control_financiero_registros(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  "movimientoCajaId" INTEGER NULL REFERENCES movimientos_caja(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  monto NUMERIC(14, 2) NOT NULL DEFAULT 0,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT control_financiero_conciliaciones_manual_detalle_tipo_chk
    CHECK (tipo IN ('REPORTE', 'CIERRE')),
  CONSTRAINT control_financiero_conciliaciones_manual_detalle_lado_chk
    CHECK (
      (
        tipo = 'REPORTE'
        AND "registroReporteId" IS NOT NULL
        AND "movimientoCajaId" IS NULL
      )
      OR
      (
        tipo = 'CIERRE'
        AND "movimientoCajaId" IS NOT NULL
        AND "registroReporteId" IS NULL
      )
    )
);

CREATE INDEX IF NOT EXISTS control_financiero_conciliaciones_manual_carga_idx
ON control_financiero_conciliaciones_manual ("cargaId", activo);

CREATE UNIQUE INDEX IF NOT EXISTS control_financiero_conciliaciones_manual_legacy_unique
ON control_financiero_conciliaciones_manual ("relacionAnteriorId")
WHERE "relacionAnteriorId" IS NOT NULL;

CREATE INDEX IF NOT EXISTS cf_conc_manual_detalle_grupo_idx
ON control_financiero_conciliaciones_manual_detalle ("conciliacionManualId", tipo);

CREATE INDEX IF NOT EXISTS cf_conc_manual_detalle_reporte_idx
ON control_financiero_conciliaciones_manual_detalle ("registroReporteId");

CREATE INDEX IF NOT EXISTS cf_conc_manual_detalle_cierre_idx
ON control_financiero_conciliaciones_manual_detalle ("movimientoCajaId");

CREATE UNIQUE INDEX IF NOT EXISTS cf_conc_manual_detalle_reporte_activo_uq
ON control_financiero_conciliaciones_manual_detalle ("registroReporteId")
WHERE activo IS TRUE AND tipo = 'REPORTE';

CREATE UNIQUE INDEX IF NOT EXISTS cf_conc_manual_detalle_cierre_activo_uq
ON control_financiero_conciliaciones_manual_detalle ("movimientoCajaId")
WHERE activo IS TRUE AND tipo = 'CIERRE';

CREATE OR REPLACE FUNCTION sync_control_financiero_conciliacion_manual_detalle_activo()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE control_financiero_conciliaciones_manual_detalle
  SET activo = NEW.activo,
      "updatedAt" = NOW()
  WHERE "conciliacionManualId" = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_control_financiero_conciliacion_manual_detalle_activo
ON control_financiero_conciliaciones_manual;

CREATE TRIGGER trg_sync_control_financiero_conciliacion_manual_detalle_activo
AFTER UPDATE OF activo ON control_financiero_conciliaciones_manual
FOR EACH ROW
WHEN (OLD.activo IS DISTINCT FROM NEW.activo)
EXECUTE FUNCTION sync_control_financiero_conciliacion_manual_detalle_activo();

DO $$
BEGIN
  IF to_regclass('public.control_financiero_relaciones_caja_manual') IS NOT NULL THEN
    INSERT INTO control_financiero_conciliaciones_manual (
      "cargaId",
      observacion,
      activo,
      "relacionadoPor",
      "relacionadoEn",
      "deshechoPor",
      "deshechoEn",
      "motivoDeshacer",
      "relacionAnteriorId",
      "createdAt",
      "updatedAt"
    )
    SELECT
      antigua."cargaId",
      antigua.observacion,
      antigua.activo,
      antigua."relacionadoPor",
      antigua."relacionadoEn",
      antigua."deshechoPor",
      antigua."deshechoEn",
      antigua."motivoDeshacer",
      antigua.id,
      antigua."createdAt",
      antigua."updatedAt"
    FROM control_financiero_relaciones_caja_manual antigua
    WHERE NOT EXISTS (
      SELECT 1
      FROM control_financiero_conciliaciones_manual nueva
      WHERE nueva."relacionAnteriorId" = antigua.id
    );

    INSERT INTO control_financiero_conciliaciones_manual_detalle (
      "conciliacionManualId",
      tipo,
      "registroReporteId",
      "movimientoCajaId",
      monto,
      activo,
      "createdAt",
      "updatedAt"
    )
    SELECT
      nueva.id,
      'REPORTE',
      antigua."registroReporteId",
      NULL,
      COALESCE(registro."pagosCuotas", 0),
      antigua.activo,
      antigua."createdAt",
      antigua."updatedAt"
    FROM control_financiero_relaciones_caja_manual antigua
    JOIN control_financiero_conciliaciones_manual nueva
      ON nueva."relacionAnteriorId" = antigua.id
    JOIN control_financiero_registros registro
      ON registro.id = antigua."registroReporteId"
    WHERE NOT EXISTS (
      SELECT 1
      FROM control_financiero_conciliaciones_manual_detalle detalle
      WHERE detalle."conciliacionManualId" = nueva.id
        AND detalle.tipo = 'REPORTE'
        AND detalle."registroReporteId" = antigua."registroReporteId"
    );

    INSERT INTO control_financiero_conciliaciones_manual_detalle (
      "conciliacionManualId",
      tipo,
      "registroReporteId",
      "movimientoCajaId",
      monto,
      activo,
      "createdAt",
      "updatedAt"
    )
    SELECT
      nueva.id,
      'CIERRE',
      NULL,
      antigua."movimientoCajaId",
      COALESCE(movimiento.valor, 0),
      antigua.activo,
      antigua."createdAt",
      antigua."updatedAt"
    FROM control_financiero_relaciones_caja_manual antigua
    JOIN control_financiero_conciliaciones_manual nueva
      ON nueva."relacionAnteriorId" = antigua.id
    JOIN movimientos_caja movimiento
      ON movimiento.id = antigua."movimientoCajaId"
    WHERE NOT EXISTS (
      SELECT 1
      FROM control_financiero_conciliaciones_manual_detalle detalle
      WHERE detalle."conciliacionManualId" = nueva.id
        AND detalle.tipo = 'CIERRE'
        AND detalle."movimientoCajaId" = antigua."movimientoCajaId"
    );

    IF (
      SELECT COUNT(*)
      FROM control_financiero_relaciones_caja_manual antigua
      WHERE NOT EXISTS (
        SELECT 1
        FROM control_financiero_conciliaciones_manual nueva
        WHERE nueva."relacionAnteriorId" = antigua.id
      )
    ) > 0 THEN
      RAISE EXCEPTION 'No se migraron todas las conciliaciones manuales 1:1.';
    END IF;

    IF (
      SELECT COUNT(*)
      FROM control_financiero_relaciones_caja_manual antigua
      JOIN control_financiero_conciliaciones_manual nueva
        ON nueva."relacionAnteriorId" = antigua.id
      LEFT JOIN LATERAL (
        SELECT COUNT(*) AS total_detalles
        FROM control_financiero_conciliaciones_manual_detalle detalle
        WHERE detalle."conciliacionManualId" = nueva.id
          AND (
            (
              detalle.tipo = 'REPORTE'
              AND detalle."registroReporteId" = antigua."registroReporteId"
            )
            OR
            (
              detalle.tipo = 'CIERRE'
              AND detalle."movimientoCajaId" = antigua."movimientoCajaId"
            )
          )
      ) detalle_migrado ON TRUE
      WHERE COALESCE(detalle_migrado.total_detalles, 0) <> 2
    ) > 0 THEN
      RAISE EXCEPTION 'No se migraron todos los detalles de conciliaciones manuales 1:1.';
    END IF;

    DROP TABLE control_financiero_relaciones_caja_manual;
  END IF;
END $$;

COMMIT;
