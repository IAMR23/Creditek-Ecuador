CREATE TABLE IF NOT EXISTS asignaciones_comerciales_historial (
  id SERIAL PRIMARY KEY,
  "usuarioId" INTEGER NOT NULL REFERENCES usuarios(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  "usuarioAgenciaId" INTEGER NOT NULL REFERENCES usuario_agencia(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  "agenciaId" INTEGER NOT NULL REFERENCES agencias(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  equipo VARCHAR(80),
  "jefeComercialId" INTEGER REFERENCES usuarios(id) ON UPDATE CASCADE ON DELETE SET NULL,
  "supervisorComercialId" INTEGER REFERENCES usuarios(id) ON UPDATE CASCADE ON DELETE SET NULL,
  "vigenciaDesde" DATE NOT NULL,
  "vigenciaHasta" DATE,
  "requiereRevision" BOOLEAN NOT NULL DEFAULT FALSE,
  fuente VARCHAR(40) NOT NULL DEFAULT 'MANUAL',
  observacion TEXT,
  "registradoPorId" INTEGER REFERENCES usuarios(id) ON UPDATE CASCADE ON DELETE SET NULL,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT asignaciones_comerciales_rango_valido
    CHECK ("vigenciaHasta" IS NULL OR "vigenciaHasta" >= "vigenciaDesde")
);

CREATE INDEX IF NOT EXISTS asignaciones_comerciales_usuario_vigencia_idx
  ON asignaciones_comerciales_historial ("usuarioId", "vigenciaDesde", "vigenciaHasta");
CREATE INDEX IF NOT EXISTS asignaciones_comerciales_ua_vigencia_idx
  ON asignaciones_comerciales_historial ("usuarioAgenciaId", "vigenciaDesde", "vigenciaHasta");
CREATE INDEX IF NOT EXISTS asignaciones_comerciales_jefe_idx
  ON asignaciones_comerciales_historial ("jefeComercialId", "vigenciaDesde");
CREATE INDEX IF NOT EXISTS asignaciones_comerciales_supervisor_idx
  ON asignaciones_comerciales_historial ("supervisorComercialId", "vigenciaDesde");
CREATE INDEX IF NOT EXISTS asignaciones_comerciales_revision_idx
  ON asignaciones_comerciales_historial ("requiereRevision") WHERE "requiereRevision" = TRUE;

CREATE OR REPLACE FUNCTION impedir_solapamiento_asignacion_comercial()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM asignaciones_comerciales_historial existente
    WHERE existente."usuarioId" = NEW."usuarioId"
      AND existente.id <> COALESCE(NEW.id, 0)
      AND daterange(
        existente."vigenciaDesde",
        COALESCE(existente."vigenciaHasta", 'infinity'::date),
        '[]'
      ) && daterange(
        NEW."vigenciaDesde",
        COALESCE(NEW."vigenciaHasta", 'infinity'::date),
        '[]'
      )
  ) THEN
    RAISE EXCEPTION 'La asignacion comercial se solapa con un tramo existente'
      USING ERRCODE = '23P01';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS asignaciones_comerciales_sin_solapamiento
  ON asignaciones_comerciales_historial;
CREATE TRIGGER asignaciones_comerciales_sin_solapamiento
BEFORE INSERT OR UPDATE OF "usuarioId", "vigenciaDesde", "vigenciaHasta"
ON asignaciones_comerciales_historial
FOR EACH ROW EXECUTE FUNCTION impedir_solapamiento_asignacion_comercial();

-- Reconstruccion conservadora: las fechas de UsuarioAgencia son evidencia de agencia,
-- pero los responsables actuales no demuestran quienes eran historicamente. Por eso
-- cada tramo importado queda pendiente de revision y no atribuye ventas automaticamente.
WITH agencias_ordenadas AS (
  SELECT
    ua.id AS "usuarioAgenciaId",
    ua."usuarioId",
    ua."agenciaId",
    ua."createdAt"::date AS fecha_asignacion,
    LEAD(ua."createdAt"::date) OVER (
      PARTITION BY ua."usuarioId" ORDER BY ua."createdAt", ua.id
    ) AS siguiente_fecha,
    u."fechaIngreso",
    u."fechaSalida",
    u."jefeComercialId",
    u."supervisorComercialId"
  FROM usuario_agencia ua
  JOIN usuarios u ON u.id = ua."usuarioId"
), tramos AS (
  SELECT *,
    GREATEST(COALESCE("fechaIngreso", fecha_asignacion), fecha_asignacion) AS desde,
    LEAST(
      COALESCE("fechaSalida", 'infinity'::date),
      COALESCE(siguiente_fecha - 1, 'infinity'::date)
    ) AS hasta
  FROM agencias_ordenadas
)
INSERT INTO asignaciones_comerciales_historial (
  "usuarioId", "usuarioAgenciaId", "agenciaId", equipo,
  "jefeComercialId", "supervisorComercialId", "vigenciaDesde", "vigenciaHasta",
  "requiereRevision", fuente, observacion, "createdAt", "updatedAt"
)
SELECT
  "usuarioId", "usuarioAgenciaId", "agenciaId", NULL,
  "jefeComercialId", "supervisorComercialId", desde,
  NULLIF(hasta, 'infinity'::date), TRUE, 'MIGRACION',
  'Responsables historicos sin evidencia suficiente; confirmar antes de atribuir ventas.',
  NOW(), NOW()
FROM tramos
WHERE desde <= hasta
  AND NOT EXISTS (
    SELECT 1 FROM asignaciones_comerciales_historial h
    WHERE h."usuarioId" = tramos."usuarioId"
  );

-- Control posterior sugerido:
-- SELECT "usuarioId", "vigenciaDesde", "vigenciaHasta", observacion
-- FROM asignaciones_comerciales_historial WHERE "requiereRevision" = TRUE;
