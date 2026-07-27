-- Verificacion previa: la tabla puede no existir en la primera ejecucion.
SELECT to_regclass('public.pagos_comisiones_multas_ajustes') AS tabla_ajustes;

CREATE TABLE IF NOT EXISTS pagos_comisiones_multas_ajustes (
  id SERIAL PRIMARY KEY,
  "usuarioId" INTEGER NOT NULL REFERENCES usuarios(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  "semanaInicio" DATE NOT NULL,
  omitida BOOLEAN NOT NULL DEFAULT TRUE,
  "actualizadoPorId" INTEGER REFERENCES usuarios(id)
    ON UPDATE CASCADE ON DELETE SET NULL,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT pagos_comisiones_multas_usuario_semana_unique
    UNIQUE ("usuarioId", "semanaInicio")
);

CREATE INDEX IF NOT EXISTS pagos_comisiones_multas_semana_idx
ON pagos_comisiones_multas_ajustes ("semanaInicio");

-- Verificacion posterior: estructura creada sin alterar pagos historicos.
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'pagos_comisiones_multas_ajustes'
ORDER BY ordinal_position;
