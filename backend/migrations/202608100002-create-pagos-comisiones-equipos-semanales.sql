BEGIN;

-- Verificacion previa: la tabla debe ser nueva en la primera ejecucion.
SELECT to_regclass('public.pagos_comisiones_equipos_semanales') AS tabla_actual;

CREATE TABLE IF NOT EXISTS pagos_comisiones_equipos_semanales (
  id SERIAL PRIMARY KEY,
  "jefeComercialId" INTEGER NOT NULL
    REFERENCES usuarios(id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  "semanaInicio" DATE NOT NULL,
  "vendedorIds" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "actualizadoPorId" INTEGER NULL
    REFERENCES usuarios(id)
    ON UPDATE CASCADE
    ON DELETE SET NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT pagos_comisiones_equipos_vendedores_array_check
    CHECK (jsonb_typeof("vendedorIds") = 'array')
);

CREATE UNIQUE INDEX IF NOT EXISTS pagos_comisiones_equipos_jefe_semana_unique
ON pagos_comisiones_equipos_semanales ("jefeComercialId", "semanaInicio");

CREATE INDEX IF NOT EXISTS pagos_comisiones_equipos_semana_idx
ON pagos_comisiones_equipos_semanales ("semanaInicio");

-- Verificacion final: muestra solamente configuraciones existentes.
SELECT
  id,
  "jefeComercialId",
  "semanaInicio",
  "vendedorIds",
  "actualizadoPorId"
FROM pagos_comisiones_equipos_semanales
ORDER BY "semanaInicio", "jefeComercialId";

COMMIT;
