DO $$
BEGIN
  IF to_regclass('public.logistica_masther_phone_ingresos') IS NULL THEN
    RAISE EXCEPTION 'Falta la tabla logistica_masther_phone_ingresos';
  END IF;
END $$;

ALTER TABLE logistica_masther_phone_ingresos
  ADD COLUMN IF NOT EXISTS "actualizadoPorId" INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'logistica_masther_phone_ingresos_actualizado_por_fk'
      AND conrelid = 'logistica_masther_phone_ingresos'::regclass
  ) THEN
    ALTER TABLE logistica_masther_phone_ingresos
      ADD CONSTRAINT logistica_masther_phone_ingresos_actualizado_por_fk
      FOREIGN KEY ("actualizadoPorId") REFERENCES usuarios(id)
      ON UPDATE CASCADE ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS logistica_masther_phone_ingresos_fecha_idx
  ON logistica_masther_phone_ingresos ("fechaIngreso" DESC);

SELECT column_name, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'logistica_masther_phone_ingresos'
  AND column_name = 'actualizadoPorId';
