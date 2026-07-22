-- Verificacion previa.
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'control_financiero_registros'
  AND column_name = 'archivoHash';

ALTER TABLE control_financiero_registros
  ADD COLUMN IF NOT EXISTS "archivoHash" VARCHAR(64);

-- Normaliza los nombres historicos generados por el almacenamiento temporal.
UPDATE control_financiero_registros
SET "archivoOrigen" = regexp_replace(
  "archivoOrigen",
  '^[0-9]{10,}-[a-f0-9]{8}-',
  '',
  'i'
)
WHERE "archivoOrigen" ~* '^[0-9]{10,}-[a-f0-9]{8}-';

CREATE INDEX IF NOT EXISTS control_financiero_registros_carga_archivo_hash_idx
ON control_financiero_registros ("cargaId", "archivoHash");

-- Los registros nuevos tendran una huella SHA-256 de 64 caracteres.
SELECT
  COUNT(*) AS total_registros,
  COUNT("archivoHash") AS registros_con_hash
FROM control_financiero_registros;
