CREATE TABLE IF NOT EXISTS sistemas_inventarios (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(120) NOT NULL,
  marca VARCHAR(80),
  modelo VARCHAR(120),
  precio NUMERIC(12, 2) CHECK (precio IS NULL OR precio >= 0),
  estado VARCHAR(40) NOT NULL DEFAULT 'OPERATIVO'
    CHECK (estado IN ('OPERATIVO', 'EN_MANTENIMIENTO', 'FUERA_DE_SERVICIO')),
  observacion TEXT,
  "agenciaId" INTEGER NOT NULL REFERENCES agencias(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  "responsableId" INTEGER NOT NULL REFERENCES usuarios(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  "creadoPorId" INTEGER REFERENCES usuarios(id) ON UPDATE CASCADE ON DELETE SET NULL,
  "actualizadoPorId" INTEGER REFERENCES usuarios(id) ON UPDATE CASCADE ON DELETE SET NULL,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS sistemas_inventarios_activo_agencia_idx
ON sistemas_inventarios (activo, "agenciaId");

CREATE INDEX IF NOT EXISTS sistemas_inventarios_responsable_idx
ON sistemas_inventarios ("responsableId");

CREATE INDEX IF NOT EXISTS sistemas_inventarios_estado_idx
ON sistemas_inventarios (estado);

-- Verificacion segura posterior a la migracion:
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'sistemas_inventarios'
ORDER BY ordinal_position;
