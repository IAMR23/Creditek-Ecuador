-- Verificación previa. Solo se crea la nueva tabla; no modifica descuentos existentes.
SELECT to_regclass('public.roles_descuentos_creditek') AS tabla_actual;
BEGIN;
CREATE TABLE IF NOT EXISTS roles_descuentos_creditek (
  id SERIAL PRIMARY KEY,
  "usuarioId" INTEGER NOT NULL REFERENCES usuarios(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  motivo VARCHAR(200) NOT NULL,
  cuotas JSONB NOT NULL DEFAULT '[]'::jsonb,
  activo BOOLEAN NOT NULL DEFAULT true,
  version INTEGER NOT NULL DEFAULT 0,
  "registradoPorId" INTEGER NOT NULL REFERENCES usuarios(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  "actualizadoPorId" INTEGER NOT NULL REFERENCES usuarios(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS roles_descuentos_creditek_usuario_idx ON roles_descuentos_creditek ("usuarioId");
COMMIT;
-- Verificación posterior.
SELECT column_name, data_type, is_nullable FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'roles_descuentos_creditek'
ORDER BY ordinal_position;
