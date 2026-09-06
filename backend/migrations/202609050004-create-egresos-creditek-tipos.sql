SELECT to_regclass('public.egresos_creditek_tipos') AS catalogo_previo;
BEGIN;
CREATE TABLE IF NOT EXISTS egresos_creditek_tipos (
  id SERIAL PRIMARY KEY,
  seccion VARCHAR(30) NOT NULL CHECK (seccion IN ('PRESTAMOS', 'ANTICIPOS')),
  codigo VARCHAR(30) NOT NULL,
  nombre VARCHAR(100) NOT NULL,
  "nombreClave" VARCHAR(100) NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  "actualizadoPorId" INTEGER REFERENCES usuarios(id) ON UPDATE CASCADE ON DELETE SET NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Compatible tambien con una tabla recien creada por sequelize.sync().
ALTER TABLE egresos_creditek_tipos ALTER COLUMN "createdAt" SET DEFAULT NOW(), ALTER COLUMN "updatedAt" SET DEFAULT NOW();
CREATE UNIQUE INDEX IF NOT EXISTS egresos_creditek_tipos_codigo_unique ON egresos_creditek_tipos(seccion, codigo);
CREATE UNIQUE INDEX IF NOT EXISTS egresos_creditek_tipos_nombre_unique ON egresos_creditek_tipos(seccion, "nombreClave");

INSERT INTO egresos_creditek_tipos(seccion, codigo, nombre, "nombreClave") VALUES
('PRESTAMOS','PLAN_MOVISTAR','Plan Movistar','plan movistar'),
('PRESTAMOS','MECANICA','Mecánica','mecanica'),
('PRESTAMOS','LENTES','Lentes','lentes'),
('PRESTAMOS','PRESTAMO_EMPRESARIAL','Préstamo empresarial','prestamo empresarial'),
('PRESTAMOS','CUOTAS_TELEFONO','Cuotas teléfono','cuotas telefono'),
('PRESTAMOS','OTROS','Otros','otros'),
('ANTICIPOS','ENTRADAS','Entradas','entradas'),
('ANTICIPOS','CAJAS','Cajas','cajas'),
('ANTICIPOS','TRANSFERENCIAS','Transferencias','transferencias'),
('ANTICIPOS','DESCUENTOS','Descuentos','descuentos'),
('ANTICIPOS','JEFES','Jefes','jefes'),
('ANTICIPOS','MULTAS_FACTURACION','Facturación','facturacion'),
('ANTICIPOS','OTROS','Otros','otros')
ON CONFLICT DO NOTHING;

-- Conserva cualquier codigo historico sin reclasificar ni borrar egresos.
INSERT INTO egresos_creditek_tipos(seccion, codigo, nombre, "nombreClave", activo)
SELECT DISTINCT e.seccion, e.tipo, 'Histórico ' || e.tipo, 'historico ' || lower(e.tipo), FALSE
FROM egresos_creditek_entradas e
WHERE NOT EXISTS (SELECT 1 FROM egresos_creditek_tipos t WHERE t.seccion=e.seccion AND t.codigo=e.tipo)
ON CONFLICT DO NOTHING;

-- Sustituye la lista cerrada por una relacion con el catalogo, sin eliminar datos.
ALTER TABLE egresos_creditek_entradas DROP CONSTRAINT IF EXISTS egresos_creditek_entradas_tipo_check;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='egresos_creditek_entradas_tipo_fk' AND conrelid='egresos_creditek_entradas'::regclass) THEN
    ALTER TABLE egresos_creditek_entradas ADD CONSTRAINT egresos_creditek_entradas_tipo_fk
    FOREIGN KEY (seccion, tipo) REFERENCES egresos_creditek_tipos(seccion, codigo) ON UPDATE RESTRICT ON DELETE RESTRICT;
  END IF;
END $$;
COMMIT;
SELECT seccion, count(*) AS tipos FROM egresos_creditek_tipos GROUP BY seccion;
