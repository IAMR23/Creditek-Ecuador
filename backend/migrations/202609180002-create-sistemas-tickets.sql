BEGIN;

CREATE SEQUENCE IF NOT EXISTS sistemas_tickets_codigo_seq START WITH 1 INCREMENT BY 1;

CREATE TABLE IF NOT EXISTS sistemas_tickets (
  id SERIAL PRIMARY KEY,
  codigo VARCHAR(20) NOT NULL UNIQUE,
  titulo VARCHAR(180) NOT NULL,
  descripcion TEXT NOT NULL,
  tipo VARCHAR(30) NOT NULL,
  proyecto VARCHAR(30) NOT NULL,
  "areaSolicitante" VARCHAR(100) NOT NULL,
  "solicitanteId" INTEGER NOT NULL REFERENCES usuarios(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  "responsableId" INTEGER REFERENCES usuarios(id) ON UPDATE CASCADE ON DELETE SET NULL,
  prioridad VARCHAR(10) NOT NULL DEFAULT 'Media',
  estado VARCHAR(30) NOT NULL DEFAULT 'Solicitado',
  "fechaInicio" DATE NOT NULL,
  "fechaEstimada" DATE NOT NULL,
  "fechaFinalizacion" TIMESTAMPTZ,
  "motivoEstado" TEXT,
  "ultimaModificacionUsuarioId" INTEGER NOT NULL REFERENCES usuarios(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  version INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT sistemas_tickets_tipo_chk CHECK (
    tipo IN ('Error', 'Mejora', 'Nuevo desarrollo', 'Soporte', 'Reporte')
  ),
  CONSTRAINT sistemas_tickets_proyecto_chk CHECK (
    proyecto IN ('RVE', 'ABS', 'GHL', 'Nómina', 'Entregas', 'Ventas', 'Shortener', 'Otro')
  ),
  CONSTRAINT sistemas_tickets_prioridad_chk CHECK (
    prioridad IN ('Baja', 'Media', 'Alta', 'Urgente')
  ),
  CONSTRAINT sistemas_tickets_estado_chk CHECK (
    estado IN ('Solicitado', 'Construcción', 'Pruebas', 'Producción')
  ),
  CONSTRAINT sistemas_tickets_fechas_chk CHECK (
    "fechaEstimada" >= "fechaInicio"
  )
);

CREATE TABLE IF NOT EXISTS sistemas_ticket_comentarios (
  id SERIAL PRIMARY KEY,
  "ticketId" INTEGER NOT NULL REFERENCES sistemas_tickets(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  "usuarioId" INTEGER NOT NULL REFERENCES usuarios(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  contenido TEXT NOT NULL CHECK (NULLIF(BTRIM(contenido), '') IS NOT NULL),
  "esEvidenciaPruebas" BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sistemas_ticket_archivos (
  id SERIAL PRIMARY KEY,
  "ticketId" INTEGER NOT NULL REFERENCES sistemas_tickets(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  "usuarioId" INTEGER NOT NULL REFERENCES usuarios(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  "nombreOriginal" VARCHAR(255) NOT NULL,
  "nombreAlmacenado" VARCHAR(100) NOT NULL UNIQUE,
  "rutaRelativa" VARCHAR(255) NOT NULL,
  "mimeType" VARCHAR(120) NOT NULL,
  tamano INTEGER NOT NULL CHECK (tamano > 0 AND tamano <= 10485760),
  "esEvidencia" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sistemas_ticket_historial (
  id SERIAL PRIMARY KEY,
  "ticketId" INTEGER NOT NULL REFERENCES sistemas_tickets(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  "usuarioId" INTEGER NOT NULL REFERENCES usuarios(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  accion VARCHAR(50) NOT NULL,
  cambios JSONB NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE sistemas_tickets
  ADD COLUMN IF NOT EXISTS "fechaInicio" DATE;

UPDATE sistemas_tickets
SET "fechaInicio" = LEAST(
  ("createdAt" AT TIME ZONE 'America/Guayaquil')::date,
  COALESCE("fechaEstimada", ("createdAt" AT TIME ZONE 'America/Guayaquil')::date)
)
WHERE "fechaInicio" IS NULL;

UPDATE sistemas_tickets
SET "fechaEstimada" = "fechaInicio"
WHERE "fechaEstimada" IS NULL;

ALTER TABLE sistemas_tickets
  ALTER COLUMN "fechaInicio" SET NOT NULL,
  ALTER COLUMN "fechaEstimada" SET NOT NULL;

-- Compatibilidad segura si una versión inicial del módulo alcanzó a crear
-- estados más detallados. El historial conserva la transición original.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'sistemas_tickets_estado_chk'
      AND conrelid = 'sistemas_tickets'::regclass
  ) THEN
    ALTER TABLE sistemas_tickets DROP CONSTRAINT sistemas_tickets_estado_chk;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'sistemas_tickets_motivo_terminal_chk'
      AND conrelid = 'sistemas_tickets'::regclass
  ) THEN
    ALTER TABLE sistemas_tickets DROP CONSTRAINT sistemas_tickets_motivo_terminal_chk;
  END IF;
END $$;

UPDATE sistemas_tickets
SET
  estado = CASE
    WHEN estado IN ('En análisis', 'Aprobado', 'En construcción', 'Construcción') THEN 'Construcción'
    WHEN estado IN ('En pruebas', 'Pruebas') THEN 'Pruebas'
    WHEN estado IN ('En producción', 'Cerrado', 'Producción') THEN 'Producción'
    WHEN estado IN ('Rechazado', 'Cancelado') THEN 'Solicitado'
    ELSE 'Solicitado'
  END,
  "fechaFinalizacion" = CASE
    WHEN estado IN ('En producción', 'Cerrado', 'Producción')
      THEN COALESCE("fechaFinalizacion", "updatedAt", NOW())
    ELSE NULL
  END,
  "updatedAt" = NOW()
WHERE estado NOT IN ('Solicitado', 'Construcción', 'Pruebas', 'Producción')
   OR (estado = 'Producción' AND "fechaFinalizacion" IS NULL);

-- Si Sequelize alcanzó a crear las tablas antes de ejecutar esta migración,
-- se completan las restricciones sin recrear ni borrar datos.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sistemas_tickets_tipo_chk') THEN
    ALTER TABLE sistemas_tickets ADD CONSTRAINT sistemas_tickets_tipo_chk
      CHECK (tipo IN ('Error', 'Mejora', 'Nuevo desarrollo', 'Soporte', 'Reporte'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sistemas_tickets_proyecto_chk') THEN
    ALTER TABLE sistemas_tickets ADD CONSTRAINT sistemas_tickets_proyecto_chk
      CHECK (proyecto IN ('RVE', 'ABS', 'GHL', 'Nómina', 'Entregas', 'Ventas', 'Shortener', 'Otro'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sistemas_tickets_prioridad_chk') THEN
    ALTER TABLE sistemas_tickets ADD CONSTRAINT sistemas_tickets_prioridad_chk
      CHECK (prioridad IN ('Baja', 'Media', 'Alta', 'Urgente'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sistemas_tickets_estado_chk') THEN
    ALTER TABLE sistemas_tickets ADD CONSTRAINT sistemas_tickets_estado_chk
      CHECK (estado IN ('Solicitado', 'Construcción', 'Pruebas', 'Producción'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sistemas_tickets_fechas_chk') THEN
    ALTER TABLE sistemas_tickets ADD CONSTRAINT sistemas_tickets_fechas_chk
      CHECK ("fechaEstimada" >= "fechaInicio");
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS sistemas_tickets_solicitante_created_idx
  ON sistemas_tickets ("solicitanteId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS sistemas_tickets_estado_prioridad_idx
  ON sistemas_tickets (estado, prioridad);
CREATE INDEX IF NOT EXISTS sistemas_tickets_responsable_estado_idx
  ON sistemas_tickets ("responsableId", estado);
CREATE INDEX IF NOT EXISTS sistemas_tickets_proyecto_idx
  ON sistemas_tickets (proyecto);
CREATE INDEX IF NOT EXISTS sistemas_tickets_created_idx
  ON sistemas_tickets ("createdAt" DESC);
CREATE INDEX IF NOT EXISTS sistemas_tickets_fecha_inicio_idx
  ON sistemas_tickets ("fechaInicio" DESC);
CREATE INDEX IF NOT EXISTS sistemas_tickets_fecha_estimada_activos_v2_idx
  ON sistemas_tickets ("fechaEstimada")
  WHERE estado <> 'Producción';
CREATE INDEX IF NOT EXISTS sistemas_ticket_comentarios_ticket_created_idx
  ON sistemas_ticket_comentarios ("ticketId", "createdAt");
CREATE INDEX IF NOT EXISTS sistemas_ticket_archivos_ticket_created_idx
  ON sistemas_ticket_archivos ("ticketId", "createdAt" DESC);
CREATE UNIQUE INDEX IF NOT EXISTS sistemas_ticket_archivos_nombre_unique
  ON sistemas_ticket_archivos ("nombreAlmacenado");
CREATE INDEX IF NOT EXISTS sistemas_ticket_historial_ticket_created_idx
  ON sistemas_ticket_historial ("ticketId", "createdAt" DESC);

DO $$
DECLARE
  ultimo_codigo BIGINT;
  valor_secuencia BIGINT;
BEGIN
  SELECT MAX(NULLIF(REGEXP_REPLACE(codigo, '\D', '', 'g'), '')::BIGINT)
  INTO ultimo_codigo
  FROM sistemas_tickets;

  IF ultimo_codigo IS NOT NULL THEN
    SELECT last_value INTO valor_secuencia FROM sistemas_tickets_codigo_seq;
    PERFORM setval(
      'sistemas_tickets_codigo_seq',
      GREATEST(ultimo_codigo, valor_secuencia),
      TRUE
    );
  END IF;
END $$;

CREATE OR REPLACE FUNCTION impedir_mutacion_ticket_inmutable()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Los comentarios y el historial de tickets son inmutables';
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'sistemas_ticket_comentarios_inmutables'
  ) THEN
    CREATE TRIGGER sistemas_ticket_comentarios_inmutables
    BEFORE UPDATE OR DELETE ON sistemas_ticket_comentarios
    FOR EACH ROW EXECUTE FUNCTION impedir_mutacion_ticket_inmutable();
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'sistemas_ticket_historial_inmutable'
  ) THEN
    CREATE TRIGGER sistemas_ticket_historial_inmutable
    BEFORE UPDATE OR DELETE ON sistemas_ticket_historial
    FOR EACH ROW EXECUTE FUNCTION impedir_mutacion_ticket_inmutable();
  END IF;
END $$;

COMMIT;

SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name IN (
  'sistemas_tickets',
  'sistemas_ticket_comentarios',
  'sistemas_ticket_archivos',
  'sistemas_ticket_historial'
)
ORDER BY table_name, ordinal_position;
