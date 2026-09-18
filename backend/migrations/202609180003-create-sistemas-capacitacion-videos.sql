BEGIN;

CREATE TABLE IF NOT EXISTS sistemas_capacitacion_videos (
  id SERIAL PRIMARY KEY,
  titulo VARCHAR(180) NOT NULL,
  enlace TEXT NOT NULL,
  descripcion TEXT NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  "creadoPorId" INTEGER REFERENCES usuarios(id) ON UPDATE CASCADE ON DELETE SET NULL,
  "actualizadoPorId" INTEGER REFERENCES usuarios(id) ON UPDATE CASCADE ON DELETE SET NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT sistemas_capacitacion_titulo_chk
    CHECK (NULLIF(BTRIM(titulo), '') IS NOT NULL AND CHAR_LENGTH(titulo) <= 180),
  CONSTRAINT sistemas_capacitacion_enlace_chk
    CHECK (enlace ~ '^https://' AND CHAR_LENGTH(enlace) <= 2048),
  CONSTRAINT sistemas_capacitacion_descripcion_chk
    CHECK (
      NULLIF(BTRIM(descripcion), '') IS NOT NULL
      AND CHAR_LENGTH(descripcion) <= 5000
    )
);

-- Sequelize puede haber creado la tabla antes de ejecutar la migración.
-- Se completan las restricciones sin recrear ni eliminar registros.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'sistemas_capacitacion_titulo_chk'
  ) THEN
    ALTER TABLE sistemas_capacitacion_videos
      ADD CONSTRAINT sistemas_capacitacion_titulo_chk
      CHECK (NULLIF(BTRIM(titulo), '') IS NOT NULL AND CHAR_LENGTH(titulo) <= 180);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'sistemas_capacitacion_enlace_chk'
  ) THEN
    ALTER TABLE sistemas_capacitacion_videos
      ADD CONSTRAINT sistemas_capacitacion_enlace_chk
      CHECK (enlace ~ '^https://' AND CHAR_LENGTH(enlace) <= 2048);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'sistemas_capacitacion_descripcion_chk'
  ) THEN
    ALTER TABLE sistemas_capacitacion_videos
      ADD CONSTRAINT sistemas_capacitacion_descripcion_chk
      CHECK (
        NULLIF(BTRIM(descripcion), '') IS NOT NULL
        AND CHAR_LENGTH(descripcion) <= 5000
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS sistemas_capacitacion_activo_created_idx
  ON sistemas_capacitacion_videos (activo, "createdAt" DESC);

CREATE INDEX IF NOT EXISTS sistemas_capacitacion_actualizado_por_idx
  ON sistemas_capacitacion_videos ("actualizadoPorId");

COMMIT;

SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'sistemas_capacitacion_videos'
ORDER BY ordinal_position;
