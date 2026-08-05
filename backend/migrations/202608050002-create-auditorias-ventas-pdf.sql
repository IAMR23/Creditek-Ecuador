BEGIN;

CREATE TABLE IF NOT EXISTS auditorias_ventas_pdf (
  id BIGSERIAL PRIMARY KEY,
  tipo VARCHAR(20) NOT NULL,
  "fechaInicio" DATE NOT NULL,
  "fechaFin" DATE NOT NULL,
  origen VARCHAR(30) NOT NULL DEFAULT 'MANUAL',
  estado VARCHAR(40) NOT NULL DEFAULT 'COMPLETADA',
  "registrosPdf" JSONB NOT NULL DEFAULT '[]'::jsonb,
  resultados JSONB NOT NULL DEFAULT '[]'::jsonb,
  resumen JSONB NOT NULL DEFAULT '{}'::jsonb,
  errores JSONB NOT NULL DEFAULT '[]'::jsonb,
  "usuarioId" INTEGER NULL
    REFERENCES usuarios(id)
    ON UPDATE CASCADE
    ON DELETE SET NULL,
  "controlFinancieroCargaId" INTEGER NULL
    REFERENCES control_financiero_cargas(id)
    ON UPDATE CASCADE
    ON DELETE SET NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT auditorias_ventas_pdf_tipo_check
    CHECK (tipo IN ('TV', 'CELULAR')),
  CONSTRAINT auditorias_ventas_pdf_fechas_check
    CHECK ("fechaInicio" <= "fechaFin")
);

CREATE INDEX IF NOT EXISTS auditorias_ventas_pdf_tipo_fechas_idx
ON auditorias_ventas_pdf (
  tipo,
  "fechaInicio",
  "fechaFin",
  "updatedAt" DESC
);

CREATE UNIQUE INDEX IF NOT EXISTS auditorias_ventas_pdf_carga_tipo_unique
ON auditorias_ventas_pdf ("controlFinancieroCargaId", tipo);

COMMIT;
