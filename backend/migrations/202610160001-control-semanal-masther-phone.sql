DO $$
BEGIN
  IF to_regclass('public.modelos') IS NULL
     OR to_regclass('public.usuarios') IS NULL
     OR to_regclass('public.logistica_masther_phone_ingresos') IS NULL THEN
    RAISE EXCEPTION 'Faltan tablas base para el control semanal Masther Phone';
  END IF;
END $$;

-- Verificacion previa: esta consulta permite revisar el volumen existente sin
-- modificar ingresos ni inventar saldos de apertura.
SELECT bodega, COUNT(*) AS movimientos, COALESCE(SUM(cantidad), 0) AS unidades
FROM logistica_masther_phone_ingresos
GROUP BY bodega
ORDER BY bodega;

SELECT
  (
    ("fechaIngreso" AT TIME ZONE 'America/Guayaquil')::date
    - (
        (
          EXTRACT(DOW FROM ("fechaIngreso" AT TIME ZONE 'America/Guayaquil')::date)::integer
          - 4 + 7
        ) % 7
      )
  )::date AS "periodoInicioJueves",
  "modeloId",
  bodega AS origen,
  COUNT(*) AS movimientos,
  SUM(cantidad) AS unidades
FROM logistica_masther_phone_ingresos
GROUP BY 1, "modeloId", bodega
ORDER BY 1, "modeloId", bodega;

CREATE TABLE IF NOT EXISTS logistica_masther_phone_cierres (
  id SERIAL PRIMARY KEY,
  "periodoInicio" DATE NOT NULL,
  "periodoFinExclusivo" DATE NOT NULL,
  "cerradoPorId" INTEGER REFERENCES usuarios(id) ON UPDATE CASCADE ON DELETE SET NULL,
  "cerradoEn" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT logistica_masther_phone_cierres_periodo_uk UNIQUE ("periodoInicio"),
  CONSTRAINT logistica_masther_phone_cierres_jueves_chk
    CHECK (EXTRACT(DOW FROM "periodoInicio") = 4),
  CONSTRAINT logistica_masther_phone_cierres_rango_chk
    CHECK ("periodoFinExclusivo" = "periodoInicio" + 7)
);

CREATE TABLE IF NOT EXISTS logistica_masther_phone_cierre_detalles (
  id SERIAL PRIMARY KEY,
  "cierreId" INTEGER NOT NULL REFERENCES logistica_masther_phone_cierres(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  "modeloId" INTEGER NOT NULL REFERENCES modelos(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  origen VARCHAR(20) NOT NULL,
  "saldoInicial" INTEGER NOT NULL,
  ingresos INTEGER NOT NULL,
  salidas INTEGER NOT NULL,
  ajustes INTEGER NOT NULL,
  "saldoFinal" INTEGER NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT logistica_masther_phone_cierre_detalles_origen_chk
    CHECK (origen IN ('CREDITEK', 'PROVEEDOR')),
  CONSTRAINT logistica_masther_phone_cierre_detalles_cantidades_chk
    CHECK ("saldoInicial" >= 0 AND ingresos >= 0 AND salidas >= 0 AND "saldoFinal" >= 0),
  CONSTRAINT logistica_masther_phone_cierre_detalles_formula_chk
    CHECK ("saldoFinal" = "saldoInicial" + ingresos - salidas + ajustes),
  CONSTRAINT logistica_masther_phone_cierre_detalles_cierre_modelo_origen_uk
    UNIQUE ("cierreId", "modeloId", origen)
);

CREATE INDEX IF NOT EXISTS logistica_masther_phone_cierre_detalles_modelo_idx
  ON logistica_masther_phone_cierre_detalles ("modeloId", "cierreId");

CREATE TABLE IF NOT EXISTS logistica_masther_phone_ajustes (
  id SERIAL PRIMARY KEY,
  "modeloId" INTEGER NOT NULL REFERENCES modelos(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  origen VARCHAR(20) NOT NULL,
  cantidad INTEGER NOT NULL,
  motivo VARCHAR(500) NOT NULL,
  tipo VARCHAR(30) NOT NULL DEFAULT 'AJUSTE',
  "cierreCorregidoId" INTEGER REFERENCES logistica_masther_phone_cierres(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  "fechaAjuste" TIMESTAMPTZ NOT NULL,
  "registradoPorId" INTEGER REFERENCES usuarios(id)
    ON UPDATE CASCADE ON DELETE SET NULL,
  "requestKey" VARCHAR(64) NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT logistica_masther_phone_ajustes_cantidad_chk CHECK (cantidad <> 0),
  CONSTRAINT logistica_masther_phone_ajustes_origen_chk
    CHECK (origen IN ('CREDITEK', 'PROVEEDOR')),
  CONSTRAINT logistica_masther_phone_ajustes_motivo_chk
    CHECK (LENGTH(BTRIM(motivo)) >= 5),
  CONSTRAINT logistica_masther_phone_ajustes_tipo_chk
    CHECK (tipo IN ('AJUSTE', 'CORRECCION_CIERRE')),
  CONSTRAINT logistica_masther_phone_ajustes_correccion_chk
    CHECK (
      (tipo = 'AJUSTE' AND "cierreCorregidoId" IS NULL)
      OR (tipo = 'CORRECCION_CIERRE' AND "cierreCorregidoId" IS NOT NULL)
    ),
  CONSTRAINT logistica_masther_phone_ajustes_request_key_uk UNIQUE ("requestKey")
);

ALTER TABLE logistica_masther_phone_ajustes
  ADD COLUMN IF NOT EXISTS tipo VARCHAR(30) NOT NULL DEFAULT 'AJUSTE',
  ADD COLUMN IF NOT EXISTS "cierreCorregidoId" INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'logistica_masther_phone_ajustes_cierre_corregido_fk'
      AND conrelid = 'logistica_masther_phone_ajustes'::regclass
  ) THEN
    ALTER TABLE logistica_masther_phone_ajustes
      ADD CONSTRAINT logistica_masther_phone_ajustes_cierre_corregido_fk
      FOREIGN KEY ("cierreCorregidoId")
      REFERENCES logistica_masther_phone_cierres(id)
      ON UPDATE CASCADE ON DELETE RESTRICT;
  END IF;
END $$;

-- Si sequelize.sync hubiera creado las tablas antes de ejecutar esta migración,
-- completar igualmente las restricciones de negocio de forma idempotente.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'logistica_masther_phone_cierres_jueves_chk'
      AND conrelid = 'logistica_masther_phone_cierres'::regclass
  ) THEN
    ALTER TABLE logistica_masther_phone_cierres
      ADD CONSTRAINT logistica_masther_phone_cierres_jueves_chk
      CHECK (EXTRACT(DOW FROM "periodoInicio") = 4);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'logistica_masther_phone_cierres_rango_chk'
      AND conrelid = 'logistica_masther_phone_cierres'::regclass
  ) THEN
    ALTER TABLE logistica_masther_phone_cierres
      ADD CONSTRAINT logistica_masther_phone_cierres_rango_chk
      CHECK ("periodoFinExclusivo" = "periodoInicio" + 7);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'logistica_masther_phone_cierre_detalles_origen_chk'
      AND conrelid = 'logistica_masther_phone_cierre_detalles'::regclass
  ) THEN
    ALTER TABLE logistica_masther_phone_cierre_detalles
      ADD CONSTRAINT logistica_masther_phone_cierre_detalles_origen_chk
      CHECK (origen IN ('CREDITEK', 'PROVEEDOR'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'logistica_masther_phone_cierre_detalles_cantidades_chk'
      AND conrelid = 'logistica_masther_phone_cierre_detalles'::regclass
  ) THEN
    ALTER TABLE logistica_masther_phone_cierre_detalles
      ADD CONSTRAINT logistica_masther_phone_cierre_detalles_cantidades_chk
      CHECK ("saldoInicial" >= 0 AND ingresos >= 0 AND salidas >= 0 AND "saldoFinal" >= 0);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'logistica_masther_phone_cierre_detalles_formula_chk'
      AND conrelid = 'logistica_masther_phone_cierre_detalles'::regclass
  ) THEN
    ALTER TABLE logistica_masther_phone_cierre_detalles
      ADD CONSTRAINT logistica_masther_phone_cierre_detalles_formula_chk
      CHECK ("saldoFinal" = "saldoInicial" + ingresos - salidas + ajustes);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'logistica_masther_phone_ajustes_cantidad_chk'
      AND conrelid = 'logistica_masther_phone_ajustes'::regclass
  ) THEN
    ALTER TABLE logistica_masther_phone_ajustes
      ADD CONSTRAINT logistica_masther_phone_ajustes_cantidad_chk CHECK (cantidad <> 0);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'logistica_masther_phone_ajustes_origen_chk'
      AND conrelid = 'logistica_masther_phone_ajustes'::regclass
  ) THEN
    ALTER TABLE logistica_masther_phone_ajustes
      ADD CONSTRAINT logistica_masther_phone_ajustes_origen_chk
      CHECK (origen IN ('CREDITEK', 'PROVEEDOR'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'logistica_masther_phone_ajustes_motivo_chk'
      AND conrelid = 'logistica_masther_phone_ajustes'::regclass
  ) THEN
    ALTER TABLE logistica_masther_phone_ajustes
      ADD CONSTRAINT logistica_masther_phone_ajustes_motivo_chk
      CHECK (LENGTH(BTRIM(motivo)) >= 5);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'logistica_masther_phone_ajustes_tipo_chk'
      AND conrelid = 'logistica_masther_phone_ajustes'::regclass
  ) THEN
    ALTER TABLE logistica_masther_phone_ajustes
      ADD CONSTRAINT logistica_masther_phone_ajustes_tipo_chk
      CHECK (tipo IN ('AJUSTE', 'CORRECCION_CIERRE'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'logistica_masther_phone_ajustes_correccion_chk'
      AND conrelid = 'logistica_masther_phone_ajustes'::regclass
  ) THEN
    ALTER TABLE logistica_masther_phone_ajustes
      ADD CONSTRAINT logistica_masther_phone_ajustes_correccion_chk
      CHECK (
        (tipo = 'AJUSTE' AND "cierreCorregidoId" IS NULL)
        OR (tipo = 'CORRECCION_CIERRE' AND "cierreCorregidoId" IS NOT NULL)
      );
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS logistica_masther_phone_cierres_periodo_uk
  ON logistica_masther_phone_cierres ("periodoInicio");

CREATE UNIQUE INDEX IF NOT EXISTS logistica_masther_phone_cierre_detalles_cierre_modelo_origen_uk
  ON logistica_masther_phone_cierre_detalles ("cierreId", "modeloId", origen);

CREATE UNIQUE INDEX IF NOT EXISTS logistica_masther_phone_ajustes_request_key_uk
  ON logistica_masther_phone_ajustes ("requestKey");

CREATE INDEX IF NOT EXISTS logistica_masther_phone_ajustes_modelo_fecha_idx
  ON logistica_masther_phone_ajustes ("modeloId", "fechaAjuste");

-- Verificacion posterior: no se insertan cierres, detalles, ajustes ni saldos.
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'logistica_masther_phone_cierres',
    'logistica_masther_phone_cierre_detalles',
    'logistica_masther_phone_ajustes'
  )
ORDER BY table_name;

SELECT indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname IN (
    'logistica_masther_phone_cierres_periodo_uk',
    'logistica_masther_phone_cierre_detalles_cierre_modelo_origen_uk',
    'logistica_masther_phone_ajustes_request_key_uk'
  )
ORDER BY indexname;
