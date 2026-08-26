ALTER TABLE reporte_caja_usuario_agencia
  ADD COLUMN IF NOT EXISTS "fechaDesde" DATE,
  ADD COLUMN IF NOT EXISTS "fechaHasta" DATE;

UPDATE reporte_caja_usuario_agencia
SET "fechaDesde" = DATE '2000-01-01'
WHERE "fechaDesde" IS NULL;

ALTER TABLE reporte_caja_usuario_agencia
  ALTER COLUMN "fechaDesde" SET DEFAULT DATE '2000-01-01',
  ALTER COLUMN "fechaDesde" SET NOT NULL;

-- Elimina un UNIQUE antiguo que impida conservar varias vigencias por codigo.
DO $$
DECLARE
  restriccion RECORD;
BEGIN
  FOR restriccion IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class tabla ON tabla.oid = con.conrelid
    WHERE tabla.relname = 'reporte_caja_usuario_agencia'
      AND con.contype = 'u'
      AND pg_get_constraintdef(con.oid) = 'UNIQUE ("codigoUsuario")'
  LOOP
    EXECUTE format(
      'ALTER TABLE reporte_caja_usuario_agencia DROP CONSTRAINT %I',
      restriccion.conname
    );
  END LOOP;
END $$;

DROP INDEX IF EXISTS reporte_caja_usuario_agencia_codigo_usuario;

DO $$
DECLARE
  indice RECORD;
BEGIN
  FOR indice IN
    SELECT indexname
    FROM pg_indexes
    WHERE tablename = 'reporte_caja_usuario_agencia'
      AND indexname LIKE 'reporte_caja_usuario_agencia_codigo_usuario_fecha_desde_fecha%'
  LOOP
    EXECUTE format('DROP INDEX IF EXISTS %I', indice.indexname);
  END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS reporte_caja_usuario_agencia_codigo_desde_uidx
ON reporte_caja_usuario_agencia ("codigoUsuario", "fechaDesde");

CREATE INDEX IF NOT EXISTS reporte_caja_usuario_agencia_codigo_vigencia_idx
ON reporte_caja_usuario_agencia ("codigoUsuario", "fechaDesde", "fechaHasta");

SELECT configuracion."codigoUsuario",
       agencias.nombre AS agencia,
       configuracion."fechaDesde",
       configuracion."fechaHasta",
       configuracion.activo
FROM reporte_caja_usuario_agencia configuracion
JOIN agencias ON agencias.id = configuracion."agenciaId"
ORDER BY configuracion."codigoUsuario", configuracion."fechaDesde" DESC;
