-- Verificacion previa
SELECT id, grupo, periodo, "promedioPorVendedor", bono
FROM comisiones_configuracion
WHERE UPPER(TRIM(grupo)) = 'JEFE COMERCIAL PISO'
  AND periodo = 'BONO_MENSUAL'
  AND activo = true
ORDER BY CAST("promedioPorVendedor" AS NUMERIC);

UPDATE comisiones_configuracion
SET "promedioPorVendedor" = '14.50',
    "updatedAt" = NOW()
WHERE UPPER(TRIM(grupo)) = 'JEFE COMERCIAL PISO'
  AND periodo = 'BONO_MENSUAL'
  AND bono = 100
  AND "promedioPorVendedor" IN ('15', '15.0', '15.00');

-- Verificacion final
SELECT id, grupo, periodo, "promedioPorVendedor", bono
FROM comisiones_configuracion
WHERE UPPER(TRIM(grupo)) = 'JEFE COMERCIAL PISO'
  AND periodo = 'BONO_MENSUAL'
  AND activo = true
ORDER BY CAST("promedioPorVendedor" AS NUMERIC);
