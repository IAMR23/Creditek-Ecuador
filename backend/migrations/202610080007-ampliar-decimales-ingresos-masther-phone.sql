DO $$
BEGIN
  IF to_regclass('public.logistica_masther_phone_ingresos') IS NULL THEN
    RAISE EXCEPTION 'Falta la tabla logistica_masther_phone_ingresos';
  END IF;
END $$;

ALTER TABLE logistica_masther_phone_ingresos
  DROP CONSTRAINT IF EXISTS logistica_masther_phone_ingresos_valores_chk;

ALTER TABLE logistica_masther_phone_ingresos
  ALTER COLUMN "precioUnitario" TYPE NUMERIC(16, 6)
    USING "precioUnitario"::NUMERIC(16, 6),
  ALTER COLUMN subtotal TYPE NUMERIC(20, 6)
    USING subtotal::NUMERIC(20, 6),
  ALTER COLUMN iva TYPE NUMERIC(20, 6)
    USING iva::NUMERIC(20, 6),
  ALTER COLUMN total TYPE NUMERIC(20, 6)
    USING total::NUMERIC(20, 6);

UPDATE logistica_masther_phone_ingresos
SET subtotal = ROUND("precioUnitario" * cantidad, 6),
    iva = ROUND(ROUND("precioUnitario" * cantidad, 6) * 0.15, 6),
    total = ROUND(
      ROUND("precioUnitario" * cantidad, 6)
      + ROUND(ROUND("precioUnitario" * cantidad, 6) * 0.15, 6),
      6
    )
WHERE "precioUnitario" IS NOT NULL;

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
      AND subtotal = ROUND("precioUnitario" * cantidad, 6)
      AND iva = ROUND(subtotal * 0.15, 6)
      AND total = ROUND(subtotal + iva, 6)
    )
  );

SELECT column_name, numeric_precision, numeric_scale
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'logistica_masther_phone_ingresos'
  AND column_name IN ('precioUnitario', 'subtotal', 'iva', 'total')
ORDER BY column_name;
