-- Registro central de Personas para ventas, entregas y prospectos.
-- Migracion idempotente: no elimina ni reemplaza datos existentes.

-- Verificacion previa.
SELECT
  (SELECT COUNT(*) FROM clientes) AS clientes_existentes,
  (SELECT COUNT(*) FROM "gestionesComerciales") AS prospectos_existentes;

ALTER TABLE clientes
ALTER COLUMN cliente DROP NOT NULL;

ALTER TABLE clientes
ADD COLUMN IF NOT EXISTS "rolId" INTEGER;

ALTER TABLE "gestionesComerciales"
ADD COLUMN IF NOT EXISTS "clienteId" INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint AS constraint_data
    INNER JOIN pg_attribute AS attribute_data
      ON attribute_data.attrelid = constraint_data.conrelid
     AND attribute_data.attnum = ANY(constraint_data.conkey)
    WHERE constraint_data.contype = 'f'
      AND constraint_data.conrelid = 'clientes'::regclass
      AND attribute_data.attname = 'rolId'
  ) THEN
    ALTER TABLE clientes
    ADD CONSTRAINT clientes_rol_id_fkey
    FOREIGN KEY ("rolId") REFERENCES roles(id)
    ON UPDATE CASCADE ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint AS constraint_data
    INNER JOIN pg_attribute AS attribute_data
      ON attribute_data.attrelid = constraint_data.conrelid
     AND attribute_data.attnum = ANY(constraint_data.conkey)
    WHERE constraint_data.contype = 'f'
      AND constraint_data.conrelid = '"gestionesComerciales"'::regclass
      AND attribute_data.attname = 'clienteId'
  ) THEN
    ALTER TABLE "gestionesComerciales"
    ADD CONSTRAINT gestiones_comerciales_cliente_id_fkey
    FOREIGN KEY ("clienteId") REFERENCES clientes(id)
    ON UPDATE CASCADE ON DELETE SET NULL;
  END IF;
END $$;

UPDATE roles
SET activo = TRUE,
    descripcion = COALESCE(descripcion, 'Promotor comercial'),
    "updatedAt" = NOW()
WHERE LOWER(BTRIM(nombre)) = 'promotor';

INSERT INTO roles (nombre, descripcion, activo, "createdAt", "updatedAt")
SELECT 'promotor', 'Promotor comercial', TRUE, NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM roles WHERE LOWER(BTRIM(nombre)) = 'promotor'
);

CREATE INDEX IF NOT EXISTS clientes_cedula_normalizada_idx
ON clientes (BTRIM(cedula))
WHERE cedula IS NOT NULL AND BTRIM(cedula) <> '';

CREATE INDEX IF NOT EXISTS clientes_telefono_normalizado_idx
ON clientes (BTRIM(telefono))
WHERE telefono IS NOT NULL AND BTRIM(telefono) <> '';

CREATE INDEX IF NOT EXISTS clientes_rol_id_idx
ON clientes ("rolId");

CREATE INDEX IF NOT EXISTS gestiones_comerciales_cliente_id_idx
ON "gestionesComerciales" ("clienteId");

-- Enriquece personas creadas antes solo con telefono cuando el prospecto ya
-- contiene una cedula que todavia no pertenece a otra persona.
WITH prospectos_con_cedula AS (
  SELECT DISTINCT ON (NULLIF(BTRIM("cedulaGestionado"), ''))
    NULLIF(BTRIM("cedulaGestionado"), '') AS cedula,
    NULLIF(BTRIM("celularGestionado"), '') AS telefono
  FROM "gestionesComerciales"
  WHERE NULLIF(BTRIM("cedulaGestionado"), '') IS NOT NULL
  ORDER BY NULLIF(BTRIM("cedulaGestionado"), ''), id
)
UPDATE clientes AS cliente
SET cedula = prospecto.cedula,
    "updatedAt" = NOW()
FROM prospectos_con_cedula AS prospecto
WHERE prospecto.cedula IS NOT NULL
  AND prospecto.telefono IS NOT NULL
  AND NULLIF(BTRIM(cliente.cedula), '') IS NULL
  AND BTRIM(cliente.telefono) = prospecto.telefono
  AND NOT EXISTS (
    SELECT 1
    FROM clientes AS existente
    WHERE NULLIF(BTRIM(existente.cedula), '') = prospecto.cedula
  );

-- Crea las personas historicas que solo existian como prospectos.
WITH prospectos AS (
  SELECT DISTINCT ON (COALESCE(
    NULLIF(BTRIM("cedulaGestionado"), ''),
    'TEL:' || NULLIF(BTRIM("celularGestionado"), '')
  ))
    NULLIF(BTRIM("cedulaGestionado"), '') AS cedula,
    NULLIF(BTRIM("celularGestionado"), '') AS telefono
  FROM "gestionesComerciales"
  WHERE NULLIF(BTRIM("cedulaGestionado"), '') IS NOT NULL
     OR NULLIF(BTRIM("celularGestionado"), '') IS NOT NULL
  ORDER BY COALESCE(
    NULLIF(BTRIM("cedulaGestionado"), ''),
    'TEL:' || NULLIF(BTRIM("celularGestionado"), '')
  ), id
)
INSERT INTO clientes (
  cliente,
  cedula,
  telefono,
  correo,
  direccion,
  "createdAt",
  "updatedAt"
)
SELECT NULL, prospecto.cedula, prospecto.telefono, NULL, NULL, NOW(), NOW()
FROM prospectos AS prospecto
WHERE NOT EXISTS (
  SELECT 1
  FROM clientes AS existente
  WHERE NULLIF(BTRIM(existente.cedula), '') = prospecto.cedula
     OR (
    prospecto.telefono IS NOT NULL
    AND NULLIF(BTRIM(existente.telefono), '') = prospecto.telefono
    AND NULLIF(BTRIM(existente.cedula), '') IS NULL
  )
);

WITH prospectos_solo_telefono AS (
  SELECT DISTINCT ON (NULLIF(BTRIM("celularGestionado"), ''))
    NULLIF(BTRIM("celularGestionado"), '') AS telefono
  FROM "gestionesComerciales"
  WHERE NULLIF(BTRIM("cedulaGestionado"), '') IS NULL
    AND NULLIF(BTRIM("celularGestionado"), '') IS NOT NULL
  ORDER BY NULLIF(BTRIM("celularGestionado"), ''), id
)
INSERT INTO clientes (
  cliente,
  cedula,
  telefono,
  correo,
  direccion,
  "createdAt",
  "updatedAt"
)
SELECT NULL, NULL, prospecto.telefono, NULL, NULL, NOW(), NOW()
FROM prospectos_solo_telefono AS prospecto
WHERE NOT EXISTS (
  SELECT 1
  FROM clientes AS existente
  WHERE NULLIF(BTRIM(existente.telefono), '') = prospecto.telefono
);

-- Enlaza cada gestion historica con la Persona correspondiente.
WITH relaciones AS (
  SELECT
    gestion.id AS gestion_id,
    COALESCE(
      (
        SELECT persona.id
        FROM clientes AS persona
        WHERE NULLIF(BTRIM(gestion."cedulaGestionado"), '') IS NOT NULL
          AND NULLIF(BTRIM(persona.cedula), '') = NULLIF(BTRIM(gestion."cedulaGestionado"), '')
        ORDER BY persona.id
        LIMIT 1
      ),
      (
        SELECT persona.id
        FROM clientes AS persona
        WHERE NULLIF(BTRIM(gestion."celularGestionado"), '') IS NOT NULL
          AND NULLIF(BTRIM(persona.telefono), '') = NULLIF(BTRIM(gestion."celularGestionado"), '')
        ORDER BY
          CASE WHEN NULLIF(BTRIM(persona.cedula), '') IS NULL THEN 0 ELSE 1 END,
          persona.id
        LIMIT 1
      )
    ) AS persona_id
  FROM "gestionesComerciales" AS gestion
  WHERE gestion."clienteId" IS NULL
)
UPDATE "gestionesComerciales" AS gestion
SET "clienteId" = relaciones.persona_id,
    "updatedAt" = NOW()
FROM relaciones
WHERE gestion.id = relaciones.gestion_id
  AND relaciones.persona_id IS NOT NULL;

-- Verificacion posterior.
SELECT
  (SELECT COUNT(*) FROM clientes) AS personas_totales,
  (SELECT COUNT(*) FROM roles WHERE LOWER(BTRIM(nombre)) = 'promotor') AS roles_promotor,
  (
    SELECT COUNT(*)
    FROM "gestionesComerciales"
    WHERE "clienteId" IS NOT NULL
  ) AS prospectos_enlazados,
  (
    SELECT COUNT(*)
    FROM "gestionesComerciales"
    WHERE "clienteId" IS NULL
      AND (
        NULLIF(BTRIM("cedulaGestionado"), '') IS NOT NULL
        OR NULLIF(BTRIM("celularGestionado"), '') IS NOT NULL
      )
  ) AS prospectos_con_datos_sin_enlace;
