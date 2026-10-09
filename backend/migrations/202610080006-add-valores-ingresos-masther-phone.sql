DO $$
BEGIN
  IF to_regclass('public.logistica_masther_phone_ingresos') IS NULL THEN
    RAISE EXCEPTION 'Falta la tabla logistica_masther_phone_ingresos';
  END IF;
END $$;

ALTER TABLE logistica_masther_phone_ingresos
  ADD COLUMN IF NOT EXISTS "precioUnitario" NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS subtotal NUMERIC(14, 2),
  ADD COLUMN IF NOT EXISTS iva NUMERIC(14, 2),
  ADD COLUMN IF NOT EXISTS total NUMERIC(14, 2);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'logistica_masther_phone_ingresos_valores_chk'
      AND conrelid = 'logistica_masther_phone_ingresos'::regclass
  ) THEN
    ALTER TABLE logistica_masther_phone_ingresos
      ADD CONSTRAINT logistica_masther_phone_ingresos_valores_chk
      CHECK (
        (
          "precioUnitario" IS NULL
          AND subtotal IS NULL
          AND iva IS NULL
          AND total IS NULL
        )
        OR
        (
          "precioUnitario" > 0
          AND subtotal = ROUND("precioUnitario" * cantidad, 2)
          AND iva = ROUND(subtotal * 0.15, 2)
          AND total = subtotal + iva
        )
      );
  END IF;
END $$;

SELECT column_name, data_type, numeric_precision, numeric_scale
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'logistica_masther_phone_ingresos'
  AND column_name IN ('precioUnitario', 'subtotal', 'iva', 'total')
ORDER BY column_name;
