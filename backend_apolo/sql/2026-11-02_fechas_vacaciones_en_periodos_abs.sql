-- ABS: documenta el descanso histórico asociado al registro de un período.
-- Es idempotente y no elimina ni transforma información existente.
BEGIN;

ALTER TABLE "vacacion_periodos"
  ADD COLUMN IF NOT EXISTS "fechaInicioVacaciones" DATE NULL,
  ADD COLUMN IF NOT EXISTS "fechaFinVacaciones" DATE NULL,
  ADD COLUMN IF NOT EXISTS "fechaReincorporacion" DATE NULL;

ALTER TABLE "vacacion_movimientos"
  ADD COLUMN IF NOT EXISTS "fechaInicioVacaciones" DATE NULL,
  ADD COLUMN IF NOT EXISTS "fechaFinVacaciones" DATE NULL,
  ADD COLUMN IF NOT EXISTS "fechaReincorporacion" DATE NULL,
  ADD COLUMN IF NOT EXISTS "anuladoAt" TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS "anuladoPorId" INTEGER NULL,
  ADD COLUMN IF NOT EXISTS "motivoAnulacion" TEXT NULL;

CREATE INDEX IF NOT EXISTS "vacacion_movimientos_descansos_vigentes_idx"
  ON "vacacion_movimientos" ("periodoId", "fechaInicioVacaciones", "fechaFinVacaciones")
  WHERE "categoria" = 'DISFRUTADO' AND "anuladoAt" IS NULL;

-- Compatibilidad con registros creados por la versión anterior del módulo.
UPDATE "vacacion_periodos"
SET "fechaFinVacaciones" = "fechaReincorporacion" - 1
WHERE "fechaInicioVacaciones" IS NOT NULL
  AND "fechaFinVacaciones" IS NULL
  AND "fechaReincorporacion" IS NOT NULL;

ALTER TABLE "vacacion_periodos"
  DROP CONSTRAINT IF EXISTS "vacacion_periodos_fechas_vacaciones_completas";

ALTER TABLE "vacacion_periodos"
  ADD CONSTRAINT "vacacion_periodos_fechas_vacaciones_completas" CHECK (
    ("fechaInicioVacaciones" IS NULL AND "fechaFinVacaciones" IS NULL AND "fechaReincorporacion" IS NULL)
    OR
    (
      "fechaInicioVacaciones" IS NOT NULL
      AND "fechaFinVacaciones" >= "fechaInicioVacaciones"
      AND "fechaReincorporacion" > "fechaFinVacaciones"
    )
  );

COMMIT;
