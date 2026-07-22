-- Verificacion previa
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'usuarios' AND column_name = 'usuario';

ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS usuario VARCHAR(50) NULL;

-- Los usuarios existentes reciben como usuario la parte local del correo.
-- Si se repite o no es valida, se agrega el ID para conservar unicidad.
WITH candidatos AS (
  SELECT
    id,
    CASE
      WHEN LENGTH(
        REGEXP_REPLACE(
          LOWER(SPLIT_PART(email, '@', 1)),
          '[^a-z0-9._-]',
          '',
          'g'
        )
      ) >= 3
      THEN LEFT(
        REGEXP_REPLACE(
          LOWER(SPLIT_PART(email, '@', 1)),
          '[^a-z0-9._-]',
          '',
          'g'
        ),
        38
      )
      ELSE 'usuario'
    END AS base
  FROM usuarios
  WHERE usuario IS NULL OR BTRIM(usuario) = ''
),
repetidos AS (
  SELECT
    id,
    base,
    COUNT(*) OVER (PARTITION BY base) AS total
  FROM candidatos
)
UPDATE usuarios AS u
SET usuario = CASE
  WHEN r.total = 1
    AND NOT EXISTS (
      SELECT 1
      FROM usuarios AS existente
      WHERE existente.id <> r.id
        AND LOWER(existente.usuario) = r.base
    )
  THEN r.base
  ELSE LEFT(r.base, 38) || '_' || r.id::text
END
FROM repetidos AS r
WHERE u.id = r.id;

CREATE UNIQUE INDEX IF NOT EXISTS usuarios_usuario_lower_unique
  ON usuarios (LOWER(usuario))
  WHERE usuario IS NOT NULL;

-- Verificacion final
SELECT id, nombre, email, usuario
FROM usuarios
ORDER BY id;
