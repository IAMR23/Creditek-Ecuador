CREATE TABLE IF NOT EXISTS denominaciones_caja_temp (
  id SERIAL PRIMARY KEY,
  "usuarioAgenciaId" INTEGER NOT NULL REFERENCES usuario_agencia(id) ON UPDATE CASCADE ON DELETE CASCADE,
  "agenciaId" INTEGER NULL REFERENCES agencias(id) ON UPDATE CASCADE ON DELETE SET NULL,
  "usuarioId" INTEGER NULL REFERENCES usuarios(id) ON UPDATE CASCADE ON DELETE SET NULL,
  valor DECIMAL(10, 2) NOT NULL,
  cantidad INTEGER NOT NULL DEFAULT 0 CHECK (cantidad >= 0),
  estado VARCHAR(20) NOT NULL DEFAULT 'ACTIVO',
  "actualizadoPorUsuarioId" INTEGER NULL REFERENCES usuarios(id) ON UPDATE CASCADE ON DELETE SET NULL,
  "fechaActualizacion" TIMESTAMP WITH TIME ZONE NULL,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS denominaciones_caja_temp_activa_unique
ON denominaciones_caja_temp ("usuarioAgenciaId", valor)
WHERE estado = 'ACTIVO';

CREATE INDEX IF NOT EXISTS denominaciones_caja_temp_usuario_agencia_idx
ON denominaciones_caja_temp ("usuarioAgenciaId", estado);

CREATE TABLE IF NOT EXISTS denominaciones_caja_historial (
  id SERIAL PRIMARY KEY,
  "usuarioAgenciaId" INTEGER NOT NULL REFERENCES usuario_agencia(id) ON UPDATE CASCADE ON DELETE CASCADE,
  "agenciaId" INTEGER NULL REFERENCES agencias(id) ON UPDATE CASCADE ON DELETE SET NULL,
  "usuarioId" INTEGER NULL REFERENCES usuarios(id) ON UPDATE CASCADE ON DELETE SET NULL,
  "cierreId" INTEGER NULL REFERENCES cierre_caja(id) ON UPDATE CASCADE ON DELETE SET NULL,
  valor DECIMAL(10, 2) NOT NULL,
  cantidad INTEGER NOT NULL DEFAULT 0 CHECK (cantidad >= 0),
  total DECIMAL(10, 2) NOT NULL DEFAULT 0,
  accion VARCHAR(30) NOT NULL,
  "creadoPorUsuarioId" INTEGER NULL REFERENCES usuarios(id) ON UPDATE CASCADE ON DELETE SET NULL,
  "fechaSnapshot" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS denominaciones_caja_historial_usuario_agencia_idx
ON denominaciones_caja_historial ("usuarioAgenciaId", "fechaSnapshot");

CREATE INDEX IF NOT EXISTS denominaciones_caja_historial_cierre_idx
ON denominaciones_caja_historial ("cierreId");
