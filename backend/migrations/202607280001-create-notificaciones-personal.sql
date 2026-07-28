BEGIN;

CREATE TABLE IF NOT EXISTS notificaciones_personal (
  id SERIAL PRIMARY KEY,
  "claveEvento" VARCHAR(160) NOT NULL,
  tipo VARCHAR(40) NOT NULL,
  titulo VARCHAR(160) NOT NULL,
  mensaje TEXT NOT NULL,
  "usuarioReferenciaId" INTEGER NULL,
  "nombreReferencia" VARCHAR(255) NULL,
  "fechaReferencia" DATE NULL,
  "fechaEvento" DATE NOT NULL,
  prioridad VARCHAR(20) NOT NULL DEFAULT 'info',
  origen VARCHAR(80) NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS notificaciones_personal_clave_evento_unique
  ON notificaciones_personal ("claveEvento");
CREATE INDEX IF NOT EXISTS notificaciones_personal_fecha_evento_idx
  ON notificaciones_personal ("fechaEvento");
CREATE INDEX IF NOT EXISTS notificaciones_personal_tipo_idx
  ON notificaciones_personal (tipo);
CREATE INDEX IF NOT EXISTS notificaciones_personal_created_at_idx
  ON notificaciones_personal ("createdAt");

CREATE TABLE IF NOT EXISTS notificaciones_personal_lecturas (
  id SERIAL PRIMARY KEY,
  "notificacionId" INTEGER NOT NULL
    REFERENCES notificaciones_personal(id)
    ON UPDATE CASCADE
    ON DELETE CASCADE,
  "usuarioId" INTEGER NOT NULL
    REFERENCES usuarios(id)
    ON UPDATE CASCADE
    ON DELETE CASCADE,
  "leidaAt" TIMESTAMPTZ NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS notificaciones_personal_lectura_unique
  ON notificaciones_personal_lecturas ("notificacionId", "usuarioId");
CREATE INDEX IF NOT EXISTS notificaciones_personal_lecturas_usuario_estado_idx
  ON notificaciones_personal_lecturas ("usuarioId", "leidaAt");

COMMIT;
