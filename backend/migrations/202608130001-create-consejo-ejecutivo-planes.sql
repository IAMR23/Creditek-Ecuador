-- Verificacion previa: las tablas nuevas deben devolver NULL en la primera ejecucion.
SELECT
  to_regclass('public.consejo_ejecutivo_salas') AS tabla_salas,
  to_regclass('public.consejo_ejecutivo_sala_participantes') AS tabla_participantes,
  to_regclass('public.consejo_ejecutivo_planes') AS tabla_planes;

CREATE TABLE IF NOT EXISTS consejo_ejecutivo_salas (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(120) NOT NULL,
  descripcion TEXT,
  "creadoPorId" INTEGER REFERENCES usuarios(id)
    ON UPDATE CASCADE ON DELETE SET NULL,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS consejo_ejecutivo_sala_participantes (
  id SERIAL PRIMARY KEY,
  "salaId" INTEGER NOT NULL REFERENCES consejo_ejecutivo_salas(id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  "usuarioId" INTEGER NOT NULL REFERENCES usuarios(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  "invitadoPorId" INTEGER REFERENCES usuarios(id)
    ON UPDATE CASCADE ON DELETE SET NULL,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT consejo_ejecutivo_sala_participantes_unique
    UNIQUE ("salaId", "usuarioId")
);

CREATE TABLE IF NOT EXISTS consejo_ejecutivo_planes (
  id SERIAL PRIMARY KEY,
  "salaId" INTEGER REFERENCES consejo_ejecutivo_salas(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  fecha DATE NOT NULL,
  condicion VARCHAR(40) NOT NULL
    CHECK (condicion IN (
      'inexistencia',
      'inexistencia_extendida',
      'peligro',
      'emergencia',
      'normal',
      'afluencia'
    )),
  "respuestasFormula" JSONB NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof("respuestasFormula") = 'object'),
  detalle JSONB NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(detalle) = 'object'),
  observaciones TEXT,
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision >= 1),
  "creadoPorId" INTEGER REFERENCES usuarios(id)
    ON UPDATE CASCADE ON DELETE SET NULL,
  "actualizadoPorId" INTEGER REFERENCES usuarios(id)
    ON UPDATE CASCADE ON DELETE SET NULL,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Compatibilidad si la primera version de Consejo Ejecutivo ya creo planes.
ALTER TABLE consejo_ejecutivo_planes
  ADD COLUMN IF NOT EXISTS "salaId" INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint AS constraint_info
    JOIN LATERAL unnest(constraint_info.conkey) AS key_column(attnum)
      ON TRUE
    JOIN pg_attribute AS attribute_info
      ON attribute_info.attrelid = constraint_info.conrelid
     AND attribute_info.attnum = key_column.attnum
    WHERE constraint_info.contype = 'f'
      AND constraint_info.conrelid = 'consejo_ejecutivo_planes'::regclass
      AND attribute_info.attname = 'salaId'
  ) THEN
    ALTER TABLE consejo_ejecutivo_planes
      ADD CONSTRAINT consejo_ejecutivo_planes_sala_id_fkey
      FOREIGN KEY ("salaId") REFERENCES consejo_ejecutivo_salas(id)
      ON UPDATE CASCADE ON DELETE RESTRICT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS consejo_ejecutivo_salas_creador_idx
ON consejo_ejecutivo_salas ("creadoPorId", activo);

CREATE INDEX IF NOT EXISTS consejo_ejecutivo_sala_participante_usuario_idx
ON consejo_ejecutivo_sala_participantes ("usuarioId", activo);

CREATE INDEX IF NOT EXISTS consejo_ejecutivo_planes_sala_idx
ON consejo_ejecutivo_planes ("salaId");

CREATE INDEX IF NOT EXISTS consejo_ejecutivo_planes_fecha_idx
ON consejo_ejecutivo_planes (fecha DESC);

CREATE INDEX IF NOT EXISTS consejo_ejecutivo_planes_condicion_idx
ON consejo_ejecutivo_planes (condicion);

CREATE INDEX IF NOT EXISTS consejo_ejecutivo_planes_actualizacion_idx
ON consejo_ejecutivo_planes ("updatedAt" DESC);

-- Verificacion posterior de estructura e indices.
SELECT table_name, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name IN (
  'consejo_ejecutivo_salas',
  'consejo_ejecutivo_sala_participantes',
  'consejo_ejecutivo_planes'
)
ORDER BY table_name, ordinal_position;

SELECT tablename, indexname, indexdef
FROM pg_indexes
WHERE tablename IN (
  'consejo_ejecutivo_salas',
  'consejo_ejecutivo_sala_participantes',
  'consejo_ejecutivo_planes'
)
ORDER BY tablename, indexname;
