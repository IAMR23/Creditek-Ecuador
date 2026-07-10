ALTER TABLE comisiones_configuracion
  ADD COLUMN IF NOT EXISTS "rolPagoId" INTEGER NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'comisiones_configuracion_rol_pago_fk'
  ) THEN
    ALTER TABLE comisiones_configuracion
      ADD CONSTRAINT comisiones_configuracion_rol_pago_fk
      FOREIGN KEY ("rolPagoId") REFERENCES roles_pago(id)
      ON UPDATE CASCADE ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS comisiones_configuracion_rol_pago_idx
  ON comisiones_configuracion ("rolPagoId");

-- Vincula automáticamente los registros históricos cuyo grupo coincide exactamente con el cargo.
UPDATE comisiones_configuracion AS c
SET "rolPagoId" = r.id,
    "updatedAt" = NOW()
FROM roles_pago AS r
WHERE c."rolPagoId" IS NULL
  AND UPPER(TRIM(c.grupo)) = UPPER(TRIM(r.cargo));

-- Equivalencias de las matrices históricas con los cargos salariales actuales.
UPDATE comisiones_configuracion AS c
SET "rolPagoId" = r.id,
    "updatedAt" = NOW()
FROM roles_pago AS r
WHERE c."rolPagoId" IS NULL
  AND UPPER(TRIM(r.cargo)) = CASE UPPER(TRIM(c.grupo))
    WHEN 'VENDEDORES DE PISO Y FURGONETA' THEN 'VENDEDOR PISO'
    WHEN 'VENDEDORES DE CALL CENTER' THEN 'VENDEDOR CALL CENTER'
  END;

SELECT c.id, c.grupo, c."rolPagoId", r.cargo
FROM comisiones_configuracion c
LEFT JOIN roles_pago r ON r.id = c."rolPagoId"
ORDER BY c.id;
