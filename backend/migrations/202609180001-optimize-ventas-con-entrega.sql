-- Diagnostico previo: conservar esta salida antes de aplicar la migracion.
SELECT
  tabla.table_name,
  tabla.column_name,
  tabla.data_type,
  tabla.is_nullable
FROM information_schema.columns tabla
WHERE tabla.table_schema = 'public'
  AND tabla.table_name IN (
    'control_financiero_registros',
    'detalle_ventas',
    'clientes'
  )
  AND tabla.column_name IN (
    'contrato_normalizado',
    'imei_normalizado',
    'fecha_normalizada',
    'referencia_pdf_normalizada',
    'cedula_normalizada'
  )
ORDER BY tabla.table_name, tabla.column_name;

BEGIN;

ALTER TABLE control_financiero_registros
  ADD COLUMN IF NOT EXISTS contrato_normalizado TEXT,
  ADD COLUMN IF NOT EXISTS imei_normalizado TEXT,
  ADD COLUMN IF NOT EXISTS fecha_normalizada TIMESTAMP WITHOUT TIME ZONE;

ALTER TABLE detalle_ventas
  ADD COLUMN IF NOT EXISTS contrato_normalizado TEXT,
  ADD COLUMN IF NOT EXISTS referencia_pdf_normalizada TEXT;

ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS cedula_normalizada TEXT;

CREATE OR REPLACE FUNCTION rve_normalizar_contrato(valor TEXT)
RETURNS TEXT
LANGUAGE SQL
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT NULLIF(REGEXP_REPLACE(UPPER(COALESCE(valor, '')), '[^A-Z0-9]', '', 'g'), '');
$$;

CREATE OR REPLACE FUNCTION rve_normalizar_texto_trim(valor TEXT)
RETURNS TEXT
LANGUAGE SQL
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT NULLIF(BTRIM(COALESCE(valor, '')), '');
$$;

CREATE OR REPLACE FUNCTION rve_normalizar_cedula(valor TEXT)
RETURNS TEXT
LANGUAGE SQL
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT REGEXP_REPLACE(COALESCE(valor, ''), '[^0-9]', '', 'g');
$$;

CREATE OR REPLACE FUNCTION rve_normalizar_fecha_control(valor TEXT)
RETURNS TIMESTAMP WITHOUT TIME ZONE
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  texto_fecha TEXT := UPPER(BTRIM(COALESCE(valor, '')));
BEGIN
  RETURN CASE
    WHEN texto_fecha ~ '^\d{1,2}/\d{1,2}/\d{2} \d{1,2}:\d{2}:\d{2} (AM|PM)$'
      THEN TO_TIMESTAMP(texto_fecha, 'MM/DD/YY HH12:MI:SS AM')
        AT TIME ZONE 'America/Guayaquil'
    WHEN texto_fecha ~ '^\d{1,2}/\d{1,2}/\d{2} \d{1,2}:\d{2} (AM|PM)$'
      THEN TO_TIMESTAMP(texto_fecha, 'MM/DD/YY HH12:MI AM')
        AT TIME ZONE 'America/Guayaquil'
    WHEN texto_fecha ~ '^\d{1,2}/\d{1,2}/\d{4} \d{1,2}:\d{2}:\d{2} (AM|PM)$'
      THEN TO_TIMESTAMP(texto_fecha, 'MM/DD/YYYY HH12:MI:SS AM')
        AT TIME ZONE 'America/Guayaquil'
    WHEN texto_fecha ~ '^\d{1,2}/\d{1,2}/\d{4} \d{1,2}:\d{2} (AM|PM)$'
      THEN TO_TIMESTAMP(texto_fecha, 'MM/DD/YYYY HH12:MI AM')
        AT TIME ZONE 'America/Guayaquil'
    ELSE NULL
  END;
EXCEPTION
  WHEN datetime_field_overflow OR invalid_datetime_format THEN
    RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION rve_actualizar_control_financiero_normalizado()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.contrato_normalizado := rve_normalizar_contrato(NEW.contrato);
  NEW.imei_normalizado := rve_normalizar_texto_trim(NEW.imei);
  NEW.fecha_normalizada := rve_normalizar_fecha_control(NEW.fecha);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION rve_actualizar_detalle_venta_normalizado()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.contrato_normalizado := rve_normalizar_contrato(NEW.contrato);
  NEW.referencia_pdf_normalizada := rve_normalizar_texto_trim(NEW."referenciaPdf");
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION rve_actualizar_cliente_cedula_normalizada()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.cedula_normalizada := rve_normalizar_cedula(NEW.cedula);
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'control_financiero_normalizar_biu'
      AND tgrelid = 'control_financiero_registros'::regclass
  ) THEN
    CREATE TRIGGER control_financiero_normalizar_biu
    BEFORE INSERT OR UPDATE OF contrato, imei, fecha
    ON control_financiero_registros
    FOR EACH ROW
    EXECUTE FUNCTION rve_actualizar_control_financiero_normalizado();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'detalle_venta_normalizar_biu'
      AND tgrelid = 'detalle_ventas'::regclass
  ) THEN
    CREATE TRIGGER detalle_venta_normalizar_biu
    BEFORE INSERT OR UPDATE OF contrato, "referenciaPdf"
    ON detalle_ventas
    FOR EACH ROW
    EXECUTE FUNCTION rve_actualizar_detalle_venta_normalizado();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'cliente_cedula_normalizar_biu'
      AND tgrelid = 'clientes'::regclass
  ) THEN
    CREATE TRIGGER cliente_cedula_normalizar_biu
    BEFORE INSERT OR UPDATE OF cedula
    ON clientes
    FOR EACH ROW
    EXECUTE FUNCTION rve_actualizar_cliente_cedula_normalizada();
  END IF;
END $$;

-- Backfill idempotente: no cambia contrato, IMEI, fecha, referencia ni cedula.
UPDATE control_financiero_registros
SET
  contrato_normalizado = rve_normalizar_contrato(contrato),
  imei_normalizado = rve_normalizar_texto_trim(imei),
  fecha_normalizada = rve_normalizar_fecha_control(fecha)
WHERE contrato_normalizado IS DISTINCT FROM rve_normalizar_contrato(contrato)
   OR imei_normalizado IS DISTINCT FROM rve_normalizar_texto_trim(imei)
   OR fecha_normalizada IS DISTINCT FROM rve_normalizar_fecha_control(fecha);

UPDATE detalle_ventas
SET
  contrato_normalizado = rve_normalizar_contrato(contrato),
  referencia_pdf_normalizada = rve_normalizar_texto_trim("referenciaPdf")
WHERE contrato_normalizado IS DISTINCT FROM rve_normalizar_contrato(contrato)
   OR referencia_pdf_normalizada IS DISTINCT FROM
      rve_normalizar_texto_trim("referenciaPdf");

UPDATE clientes
SET cedula_normalizada = rve_normalizar_cedula(cedula)
WHERE cedula_normalizada IS DISTINCT FROM rve_normalizar_cedula(cedula);

COMMIT;

-- MIGRATION_CONCURRENT_INDEXES
-- Cada sentencia debe ejecutarse fuera de una transaccion. CREATE INDEX
-- CONCURRENTLY evita bloquear INSERT/UPDATE/DELETE durante todo el escaneo.
CREATE INDEX CONCURRENTLY IF NOT EXISTS control_financiero_registros_imei_normalizado_idx
  ON control_financiero_registros (
    imei_normalizado,
    fecha_normalizada DESC,
    id DESC
  )
  WHERE "tipoRegistro" = 'VENTA_CELULAR'
    AND imei_normalizado IS NOT NULL
    AND fecha_normalizada IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS control_financiero_registros_contrato_normalizado_idx
  ON control_financiero_registros (
    contrato_normalizado,
    "tipoRegistro",
    fecha_normalizada DESC,
    id DESC
  )
  WHERE "tipoRegistro" IN ('VENTA_CELULAR', 'VENTA_TV')
    AND contrato_normalizado IS NOT NULL
    AND fecha_normalizada IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS detalle_ventas_venta_id_idx
  ON detalle_ventas ("ventaId");

CREATE INDEX CONCURRENTLY IF NOT EXISTS clientes_cedula_normalizada_reporte_idx
  ON clientes (cedula_normalizada)
  WHERE cedula_normalizada IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS ventas_cliente_activa_idx
  ON ventas ("clienteId")
  WHERE activo IS TRUE;

CREATE INDEX CONCURRENTLY IF NOT EXISTS entregas_venta_id_idx
  ON entregas ("ventaId");

-- Verificacion posterior: cobertura del backfill e indices disponibles.
SELECT
  COUNT(*) AS total,
  COUNT(*) FILTER (
    WHERE "tipoRegistro" IN ('VENTA_CELULAR', 'VENTA_TV')
  ) AS ventas_control,
  COUNT(*) FILTER (WHERE fecha_normalizada IS NOT NULL) AS fechas_normalizadas,
  COUNT(*) FILTER (
    WHERE contrato IS NOT NULL AND contrato_normalizado IS NULL
  ) AS contratos_pendientes,
  COUNT(*) FILTER (
    WHERE imei IS NOT NULL AND imei_normalizado IS NULL
  ) AS imeis_pendientes
FROM control_financiero_registros;

SELECT tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname IN (
    'control_financiero_registros_imei_normalizado_idx',
    'control_financiero_registros_contrato_normalizado_idx',
    'detalle_ventas_venta_id_idx',
    'clientes_cedula_normalizada_reporte_idx',
    'ventas_cliente_activa_idx',
    'entregas_venta_id_idx'
  )
ORDER BY tablename, indexname;
