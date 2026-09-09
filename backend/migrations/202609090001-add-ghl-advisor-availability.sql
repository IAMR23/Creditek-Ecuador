-- Verificacion previa: estas tablas/columnas pueden no existir antes de aplicar.
SELECT to_regclass('public.ghl_asesor_vinculos'),
       to_regclass('public.ghl_asesor_disponibilidad_historial');
SELECT column_name
FROM information_schema.columns
WHERE table_name IN ('ghl_reparto_configuraciones', 'ghl_reparto_ejecucion_detalles')
  AND column_name IN ('intervaloMinutos', 'assignedAt');

ALTER TABLE ghl_reparto_configuraciones
  ADD COLUMN IF NOT EXISTS "intervaloMinutos" INTEGER NOT NULL DEFAULT 1;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ghl_reparto_config_intervalo_minutos_chk'
  ) THEN
    ALTER TABLE ghl_reparto_configuraciones
      ADD CONSTRAINT ghl_reparto_config_intervalo_minutos_chk
      CHECK ("intervaloMinutos" BETWEEN 1 AND 60);
  END IF;
END $$;

ALTER TABLE ghl_reparto_ejecucion_detalles
  ADD COLUMN IF NOT EXISTS "assignedAt" TIMESTAMPTZ;

UPDATE ghl_reparto_ejecucion_detalles
SET "assignedAt" = COALESCE("assignedAt", "updatedAt")
WHERE estado = 'assigned' AND "assignedAt" IS NULL;

CREATE TABLE IF NOT EXISTS ghl_asesor_vinculos (
  id SERIAL PRIMARY KEY,
  "usuarioId" INTEGER NOT NULL REFERENCES usuarios(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  "ghlUserId" VARCHAR(100) NOT NULL,
  "ghlNombre" VARCHAR(200) NOT NULL,
  "ghlEmail" VARCHAR(200),
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  "estadoRecepcion" VARCHAR(10) NOT NULL DEFAULT 'PAUSADO',
  "estadoFechaLocal" DATE,
  "estadoCambiadoAt" TIMESTAMPTZ,
  "estadoCambiadoPorId" INTEGER REFERENCES usuarios(id) ON UPDATE CASCADE ON DELETE SET NULL,
  "motivoUltimoCambio" VARCHAR(20),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ghl_asesor_vinculo_estado_chk CHECK ("estadoRecepcion" IN ('ACTIVO', 'PAUSADO')),
  CONSTRAINT ghl_asesor_vinculo_motivo_chk CHECK ("motivoUltimoCambio" IS NULL OR "motivoUltimoCambio" IN ('asesor', 'administrador'))
);

CREATE UNIQUE INDEX IF NOT EXISTS ghl_asesor_vinculo_usuario_unique
  ON ghl_asesor_vinculos ("usuarioId");
CREATE UNIQUE INDEX IF NOT EXISTS ghl_asesor_vinculo_ghl_user_unique
  ON ghl_asesor_vinculos ("ghlUserId");
CREATE INDEX IF NOT EXISTS ghl_asesor_vinculo_disponibilidad_idx
  ON ghl_asesor_vinculos (activo, "estadoRecepcion", "estadoFechaLocal");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ghl_asesor_vinculo_estado_chk') THEN
    ALTER TABLE ghl_asesor_vinculos ADD CONSTRAINT ghl_asesor_vinculo_estado_chk
      CHECK ("estadoRecepcion" IN ('ACTIVO', 'PAUSADO'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ghl_asesor_vinculo_motivo_chk') THEN
    ALTER TABLE ghl_asesor_vinculos ADD CONSTRAINT ghl_asesor_vinculo_motivo_chk
      CHECK ("motivoUltimoCambio" IS NULL OR "motivoUltimoCambio" IN ('asesor', 'administrador'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS ghl_asesor_disponibilidad_historial (
  id BIGSERIAL PRIMARY KEY,
  "vinculoId" INTEGER NOT NULL REFERENCES ghl_asesor_vinculos(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  "usuarioId" INTEGER NOT NULL REFERENCES usuarios(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  "ghlUserId" VARCHAR(100) NOT NULL,
  accion VARCHAR(20) NOT NULL DEFAULT 'ESTADO',
  "estadoAnterior" VARCHAR(10),
  "estadoNuevo" VARCHAR(10) NOT NULL,
  "cambiadoPorId" INTEGER REFERENCES usuarios(id) ON UPDATE CASCADE ON DELETE SET NULL,
  "motivoCambio" VARCHAR(20) NOT NULL,
  "fechaLocal" DATE NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ghl_asesor_historial_accion_chk CHECK (accion IN ('ESTADO', 'ASOCIACION')),
  CONSTRAINT ghl_asesor_historial_estado_anterior_chk CHECK ("estadoAnterior" IS NULL OR "estadoAnterior" IN ('ACTIVO', 'PAUSADO')),
  CONSTRAINT ghl_asesor_historial_estado_nuevo_chk CHECK ("estadoNuevo" IN ('ACTIVO', 'PAUSADO')),
  CONSTRAINT ghl_asesor_historial_motivo_chk CHECK ("motivoCambio" IN ('asesor', 'administrador'))
);

CREATE INDEX IF NOT EXISTS ghl_asesor_historial_usuario_fecha_idx
  ON ghl_asesor_disponibilidad_historial ("usuarioId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS ghl_asesor_historial_ghl_fecha_idx
  ON ghl_asesor_disponibilidad_historial ("ghlUserId", "createdAt" DESC);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ghl_asesor_historial_accion_chk') THEN
    ALTER TABLE ghl_asesor_disponibilidad_historial ADD CONSTRAINT ghl_asesor_historial_accion_chk
      CHECK (accion IN ('ESTADO', 'ASOCIACION'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ghl_asesor_historial_estado_anterior_chk') THEN
    ALTER TABLE ghl_asesor_disponibilidad_historial ADD CONSTRAINT ghl_asesor_historial_estado_anterior_chk
      CHECK ("estadoAnterior" IS NULL OR "estadoAnterior" IN ('ACTIVO', 'PAUSADO'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ghl_asesor_historial_estado_nuevo_chk') THEN
    ALTER TABLE ghl_asesor_disponibilidad_historial ADD CONSTRAINT ghl_asesor_historial_estado_nuevo_chk
      CHECK ("estadoNuevo" IN ('ACTIVO', 'PAUSADO'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ghl_asesor_historial_motivo_chk') THEN
    ALTER TABLE ghl_asesor_disponibilidad_historial ADD CONSTRAINT ghl_asesor_historial_motivo_chk
      CHECK ("motivoCambio" IN ('asesor', 'administrador'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS ghl_reparto_detalle_asignado_fecha_idx
  ON ghl_reparto_ejecucion_detalles ("newAssignedTo", "assignedAt")
  WHERE estado = 'assigned';

-- Verificacion posterior.
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name IN (
  'ghl_asesor_vinculos',
  'ghl_asesor_disponibilidad_historial',
  'ghl_reparto_configuraciones',
  'ghl_reparto_ejecucion_detalles'
)
ORDER BY table_name, ordinal_position;

-- Reversion manual: conservar historiales si el modulo ya recibio trafico.
-- DROP INDEX IF EXISTS ghl_reparto_detalle_asignado_fecha_idx;
-- DROP TABLE IF EXISTS ghl_asesor_disponibilidad_historial;
-- DROP TABLE IF EXISTS ghl_asesor_vinculos;
-- ALTER TABLE ghl_reparto_ejecucion_detalles DROP COLUMN IF EXISTS "assignedAt";
-- ALTER TABLE ghl_reparto_configuraciones DROP CONSTRAINT IF EXISTS ghl_reparto_config_intervalo_minutos_chk;
-- ALTER TABLE ghl_reparto_configuraciones DROP COLUMN IF EXISTS "intervaloMinutos";
