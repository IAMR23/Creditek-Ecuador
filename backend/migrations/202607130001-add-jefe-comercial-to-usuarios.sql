-- Verificacion previa
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'usuarios' AND column_name = 'jefeComercialId';

ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS "jefeComercialId" INTEGER NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'usuarios_jefe_comercial_fk'
  ) THEN
    ALTER TABLE usuarios
      ADD CONSTRAINT usuarios_jefe_comercial_fk
      FOREIGN KEY ("jefeComercialId") REFERENCES usuarios(id)
      ON UPDATE CASCADE ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS usuarios_jefe_comercial_idx
  ON usuarios ("jefeComercialId");

-- Verificacion final (no modifica asignaciones existentes)
SELECT id, nombre, "jefeComercialId"
FROM usuarios
WHERE "jefeComercialId" IS NOT NULL
ORDER BY nombre;
