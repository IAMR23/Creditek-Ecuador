CREATE TABLE IF NOT EXISTS mapa_comercial_zonas (
  id SERIAL PRIMARY KEY,
  "agenciaId" INTEGER NOT NULL REFERENCES agencias(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  nombre VARCHAR(255) NOT NULL,
  tipo VARCHAR(255) NOT NULL DEFAULT 'sector',
  "latitudCentro" DECIMAL(10, 7),
  "longitudCentro" DECIMAL(10, 7),
  "radioMetros" INTEGER,
  poligono JSONB,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS mapa_comercial_zonas_agencia_nombre_unique
ON mapa_comercial_zonas ("agenciaId", nombre);

CREATE INDEX IF NOT EXISTS mapa_comercial_zonas_activo_agencia_idx
ON mapa_comercial_zonas (activo, "agenciaId");

CREATE TABLE IF NOT EXISTS mapa_ubicaciones_normalizadas (
  id SERIAL PRIMARY KEY,
  "entidadTipo" VARCHAR(255) NOT NULL,
  "entidadId" INTEGER NOT NULL,
  "ubicacionOriginal" TEXT,
  "tipoUbicacion" VARCHAR(255),
  latitud DECIMAL(10, 7),
  longitud DECIMAL(10, 7),
  "estadoGeocodificacion" VARCHAR(255) NOT NULL DEFAULT 'pendiente',
  precision VARCHAR(255),
  "procesadoEn" TIMESTAMP WITH TIME ZONE,
  "errorDetalle" TEXT,
  "zonaId" INTEGER REFERENCES mapa_comercial_zonas(id) ON UPDATE CASCADE ON DELETE SET NULL,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS mapa_ubicaciones_entidad_unique
ON mapa_ubicaciones_normalizadas ("entidadTipo", "entidadId");

CREATE INDEX IF NOT EXISTS mapa_ubicaciones_estado_idx
ON mapa_ubicaciones_normalizadas ("estadoGeocodificacion");
