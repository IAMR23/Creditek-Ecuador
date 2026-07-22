-- Verificacion previa: revisar si la columna ya existe.
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'control_financiero_cargas'
  AND column_name = 'fechaReporte';

ALTER TABLE control_financiero_cargas
  ADD COLUMN IF NOT EXISTS "fechaReporte" DATE;

-- Recupera la fecha del primer registro de caja de cada carga historica.
-- Los PDFs pueden expresar la fecha como MM/DD/YY o DD/MM/YY. Cuando uno de
-- los dos primeros componentes supera 12 se usa para resolver el formato;
-- en fechas ambiguas se conserva el formato MM/DD/YY que emite el reporte.
WITH candidatas AS (
  SELECT
    "cargaId",
    id,
    substring(fecha FROM '[0-9]{1,2}/[0-9]{1,2}/[0-9]{2}') AS fecha_pdf
  FROM control_financiero_registros
  WHERE "tipoRegistro" = 'CAJA'
    AND fecha ~ '[0-9]{1,2}/[0-9]{1,2}/[0-9]{2}'
),
primeras AS (
  SELECT DISTINCT ON ("cargaId")
    "cargaId",
    fecha_pdf
  FROM candidatas
  WHERE fecha_pdf IS NOT NULL
  ORDER BY "cargaId", id
),
normalizadas AS (
  SELECT
    "cargaId",
    CASE
      WHEN split_part(fecha_pdf, '/', 1)::INTEGER > 12
        THEN to_date(fecha_pdf, 'DD/MM/YY')
      ELSE to_date(fecha_pdf, 'MM/DD/YY')
    END AS fecha_reporte
  FROM primeras
)
UPDATE control_financiero_cargas AS carga
SET "fechaReporte" = normalizadas.fecha_reporte,
    "updatedAt" = NOW()
FROM normalizadas
WHERE carga.id = normalizadas."cargaId"
  AND carga."fechaReporte" IS NULL;

CREATE INDEX IF NOT EXISTS control_financiero_cargas_fecha_reporte_idx
ON control_financiero_cargas ("fechaReporte" DESC);

-- Verificacion posterior: las cargas con registros validos deben tener fecha.
SELECT id, "fechaReporte", "createdAt", "archivoGenerado"
FROM control_financiero_cargas
ORDER BY id DESC
LIMIT 20;
