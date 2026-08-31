-- Verificacion previa
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'egresos_creditek_entradas'
  AND column_name IN (
    'observacion',
    'fecha',
    'seccion',
    'activo',
    'ultimaAccion',
    'actualizadoPorId'
  )
ORDER BY column_name;

ALTER TABLE egresos_creditek_entradas
  ADD COLUMN IF NOT EXISTS observacion TEXT,
  ADD COLUMN IF NOT EXISTS fecha DATE,
  ADD COLUMN IF NOT EXISTS seccion VARCHAR(30) NOT NULL DEFAULT 'ENTRADAS',
  ADD COLUMN IF NOT EXISTS activo BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS "ultimaAccion" VARCHAR(20) NOT NULL DEFAULT 'CREADO',
  ADD COLUMN IF NOT EXISTS "actualizadoPorId" INTEGER NULL
    REFERENCES usuarios(id) ON UPDATE CASCADE ON DELETE SET NULL;

UPDATE egresos_creditek_entradas
SET seccion = COALESCE(seccion, 'ENTRADAS'),
    activo = COALESCE(activo, TRUE),
    "ultimaAccion" = COALESCE("ultimaAccion", 'CREADO')
WHERE seccion IS NULL
   OR activo IS NULL
   OR "ultimaAccion" IS NULL;

CREATE INDEX IF NOT EXISTS egresos_creditek_entradas_seccion_idx
  ON egresos_creditek_entradas (seccion);

CREATE INDEX IF NOT EXISTS egresos_creditek_entradas_fecha_idx
  ON egresos_creditek_entradas (fecha);

-- Verificacion posterior
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'egresos_creditek_entradas'
  AND column_name IN (
    'observacion',
    'fecha',
    'seccion',
    'activo',
    'ultimaAccion',
    'actualizadoPorId'
  )
ORDER BY column_name;

SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'egresos_creditek_entradas'
  AND indexname IN (
    'egresos_creditek_entradas_seccion_idx',
    'egresos_creditek_entradas_fecha_idx'
  )
ORDER BY indexname;
