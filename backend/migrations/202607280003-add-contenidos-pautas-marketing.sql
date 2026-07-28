-- Verificacion previa de la estructura actual.
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'pautas_marketing'
  AND column_name = 'contenidos';

ALTER TABLE IF EXISTS pautas_marketing
ADD COLUMN IF NOT EXISTS contenidos JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Conserva los registros creados con la primera version de la pantalla.
UPDATE pautas_marketing
SET contenidos = jsonb_build_array(
  jsonb_build_object(
    'producto', producto,
    'tipoContenido', "tipoContenido"
  )
)
WHERE COALESCE(contenidos, '[]'::jsonb) = '[]'::jsonb
  AND producto IS NOT NULL
  AND "tipoContenido" IS NOT NULL;

-- Verificacion posterior de los contenidos migrados.
SELECT
  id,
  "nombrePagina",
  jsonb_array_length(contenidos) AS cantidad_contenidos
FROM pautas_marketing
ORDER BY id;
