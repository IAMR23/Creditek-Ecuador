-- Verificacion previa
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'usuarios' AND column_name = 'supervisorComercialId';

ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS "supervisorComercialId" INTEGER NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'usuarios_supervisor_comercial_fk'
  ) THEN
    ALTER TABLE usuarios
      ADD CONSTRAINT usuarios_supervisor_comercial_fk
      FOREIGN KEY ("supervisorComercialId") REFERENCES usuarios(id)
      ON UPDATE CASCADE ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS usuarios_supervisor_comercial_idx
  ON usuarios ("supervisorComercialId");

-- Verificacion final
SELECT id, nombre, "supervisorComercialId"
FROM usuarios
WHERE "supervisorComercialId" IS NOT NULL
ORDER BY nombre;
