-- Las cargas autenticadas con API key no representan a un usuario interactivo.
-- Un importadoPorId nulo identifica esas cargas sin inventar un usuario tecnico.
ALTER TABLE IF EXISTS uphone_solicitudes
  ALTER COLUMN "importadoPorId" DROP NOT NULL;

-- Verificacion:
-- SELECT "importadoPorId", COUNT(*)
-- FROM uphone_solicitudes
-- GROUP BY "importadoPorId"
-- ORDER BY "importadoPorId" NULLS FIRST;

-- No se incluye reversa automatica: volver a NOT NULL fallaria si ya existen
-- cargas realizadas mediante API key.
