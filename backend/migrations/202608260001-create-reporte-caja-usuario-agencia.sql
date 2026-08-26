CREATE TABLE IF NOT EXISTS reporte_caja_usuario_agencia (
  id SERIAL PRIMARY KEY,
  "codigoUsuario" VARCHAR(80) NOT NULL,
  "agenciaId" INTEGER NOT NULL REFERENCES agencias(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  "fechaDesde" DATE NOT NULL DEFAULT DATE '2000-01-01',
  "fechaHasta" DATE,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS reporte_caja_usuario_agencia_codigo_desde_uidx
ON reporte_caja_usuario_agencia ("codigoUsuario", "fechaDesde");

CREATE INDEX IF NOT EXISTS reporte_caja_usuario_agencia_activo_agencia_idx
ON reporte_caja_usuario_agencia (activo, "agenciaId");

-- Carga inicial compatible con el mapeo que existia en Python.
INSERT INTO reporte_caja_usuario_agencia
  ("codigoUsuario", "agenciaId", "fechaDesde", "fechaHasta", activo, "createdAt", "updatedAt")
SELECT datos.usuario, agencias.id, DATE '2000-01-01', NULL, TRUE, NOW(), NOW()
FROM (
  VALUES
    ('ALEXFER', 'NUEVA AURORA'),
    ('GABYMATRIZ', 'NUEVA AURORA'),
    ('GABYCAUP', 'NUEVA AURORA'),
    ('GABYSANGO', 'NUEVA AURORA'),
    ('GABYCHILLO', 'NUEVA AURORA'),
    ('DAMIZA', 'CAUPICHO'),
    ('CHAVICTK', 'SANGOLQUI')
) AS datos(usuario, agencia)
JOIN agencias ON UPPER(TRIM(agencias.nombre)) = datos.agencia
ON CONFLICT DO NOTHING;

-- Verificacion segura posterior a la migracion.
SELECT configuracion.id,
       configuracion."codigoUsuario",
       agencias.nombre AS agencia,
       configuracion."fechaDesde",
       configuracion."fechaHasta",
       configuracion.activo
FROM reporte_caja_usuario_agencia configuracion
JOIN agencias ON agencias.id = configuracion."agenciaId"
ORDER BY configuracion."codigoUsuario";
