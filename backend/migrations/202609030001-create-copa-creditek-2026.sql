-- Verificación previa: las tablas deben ser nuevas en la primera ejecución.
SELECT
  to_regclass('public.copa_creditek_vendedores_configuracion') AS configuracion_vendedores,
  to_regclass('public.copa_creditek_semanas_vendedores') AS configuracion_periodos;

CREATE TABLE IF NOT EXISTS copa_creditek_vendedores_configuracion (
  id SERIAL PRIMARY KEY,
  "usuarioId" INTEGER NOT NULL REFERENCES usuarios(id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  alias VARCHAR(50),
  "equipoCopa" VARCHAR(40),
  "mostrarEnMarcador" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT copa_creditek_vendedores_equipo_chk CHECK (
    "equipoCopa" IS NULL OR "equipoCopa" IN (
      'Martha Bucaram',
      'Caupicho',
      'Nueva Aurora',
      'Sangolquí'
    )
  ),
  CONSTRAINT copa_creditek_vendedores_alias_chk CHECK (
    alias IS NULL OR LENGTH(BTRIM(alias)) BETWEEN 1 AND 50
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS copa_creditek_vendedores_config_usuario_uidx
ON copa_creditek_vendedores_configuracion ("usuarioId");

ALTER TABLE copa_creditek_vendedores_configuracion
  ADD COLUMN IF NOT EXISTS "mostrarEnMarcador" BOOLEAN NOT NULL DEFAULT TRUE;

CREATE TABLE IF NOT EXISTS copa_creditek_semanas_vendedores (
  id SERIAL PRIMARY KEY,
  "usuarioId" INTEGER NOT NULL REFERENCES usuarios(id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  "fechaInicio" DATE NOT NULL,
  "fechaFin" DATE NOT NULL,
  meta INTEGER NOT NULL DEFAULT 0,
  "ventasManual" INTEGER,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT copa_creditek_semana_fechas_chk CHECK ("fechaInicio" <= "fechaFin"),
  CONSTRAINT copa_creditek_semana_meta_chk CHECK (meta >= 0),
  CONSTRAINT copa_creditek_semana_ventas_manual_chk CHECK (
    "ventasManual" IS NULL OR "ventasManual" >= 0
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS copa_creditek_semana_vendedor_periodo_uidx
ON copa_creditek_semanas_vendedores ("usuarioId", "fechaInicio", "fechaFin");

CREATE INDEX IF NOT EXISTS copa_creditek_semana_periodo_idx
ON copa_creditek_semanas_vendedores ("fechaInicio", "fechaFin");

-- Si Sequelize creó las tablas antes de aplicar esta migración, agregar también
-- las restricciones faltantes de forma idempotente.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'copa_creditek_vendedores_equipo_chk'
  ) THEN
    ALTER TABLE copa_creditek_vendedores_configuracion
      ADD CONSTRAINT copa_creditek_vendedores_equipo_chk CHECK (
        "equipoCopa" IS NULL OR "equipoCopa" IN (
          'Martha Bucaram', 'Caupicho', 'Nueva Aurora', 'Sangolquí'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'copa_creditek_vendedores_alias_chk'
  ) THEN
    ALTER TABLE copa_creditek_vendedores_configuracion
      ADD CONSTRAINT copa_creditek_vendedores_alias_chk CHECK (
        alias IS NULL OR LENGTH(BTRIM(alias)) BETWEEN 1 AND 50
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'copa_creditek_semana_fechas_chk'
  ) THEN
    ALTER TABLE copa_creditek_semanas_vendedores
      ADD CONSTRAINT copa_creditek_semana_fechas_chk
      CHECK ("fechaInicio" <= "fechaFin");
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'copa_creditek_semana_meta_chk'
  ) THEN
    ALTER TABLE copa_creditek_semanas_vendedores
      ADD CONSTRAINT copa_creditek_semana_meta_chk CHECK (meta >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'copa_creditek_semana_ventas_manual_chk'
  ) THEN
    ALTER TABLE copa_creditek_semanas_vendedores
      ADD CONSTRAINT copa_creditek_semana_ventas_manual_chk CHECK (
        "ventasManual" IS NULL OR "ventasManual" >= 0
      );
  END IF;
END $$;

-- Verificación posterior: estructura y restricciones, sin alterar ventas reales.
SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name IN (
  'copa_creditek_vendedores_configuracion',
  'copa_creditek_semanas_vendedores'
)
ORDER BY table_name, ordinal_position;

SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename IN (
  'copa_creditek_vendedores_configuracion',
  'copa_creditek_semanas_vendedores'
)
ORDER BY tablename, indexname;
