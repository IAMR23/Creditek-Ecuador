-- Verificacion previa
SELECT
  id,
  grupo,
  subgrupo,
  periodo,
  "unidadesVendidas",
  "comisionPorEquipo",
  "valorAproximado",
  orden,
  activo
FROM comisiones_configuracion
WHERE UPPER(TRIM(grupo)) = 'SUPERVISOR CALL CENTER'
  AND UPPER(TRIM(COALESCE(subgrupo, ''))) = '5 VENDEDORES'
  AND periodo = 'COMISION_SEMANAL'
ORDER BY orden, CAST("unidadesVendidas" AS NUMERIC);

WITH nuevas_comisiones (
  subgrupo,
  unidades_vendidas,
  comision_por_equipo,
  valor_aproximado,
  orden
) AS (
  VALUES
    ('5 vendedores', '50', 1.0000, '50', 82),
    ('5 vendedores', '55', 1.5000, '82.5', 83),
    ('5 vendedores', '60', 2.0000, '120', 84),
    ('5 vendedores', '75', 3.0000, '225', 85)
)
INSERT INTO comisiones_configuracion (
  "rolPagoId",
  grupo,
  subgrupo,
  periodo,
  "unidadesVendidas",
  "comisionPorEquipo",
  porcentaje,
  "promedioPorVendedor",
  bono,
  "valorAproximado",
  notas,
  orden,
  activo,
  "createdAt",
  "updatedAt"
)
SELECT
  (
    SELECT id
    FROM roles_pago
    WHERE UPPER(TRIM(cargo)) = 'SUPERVISOR CALL CENTER'
      AND activo = true
    ORDER BY id
    LIMIT 1
  ),
  'SUPERVISOR CALL CENTER',
  nueva.subgrupo,
  'COMISION_SEMANAL',
  nueva.unidades_vendidas,
  nueva.comision_por_equipo,
  NULL,
  NULL,
  NULL,
  nueva.valor_aproximado,
  NULL,
  nueva.orden,
  true,
  NOW(),
  NOW()
FROM nuevas_comisiones AS nueva
WHERE NOT EXISTS (
  SELECT 1
  FROM comisiones_configuracion AS existente
  WHERE UPPER(TRIM(existente.grupo)) = 'SUPERVISOR CALL CENTER'
    AND UPPER(TRIM(COALESCE(existente.subgrupo, ''))) = '5 VENDEDORES'
    AND existente.periodo = 'COMISION_SEMANAL'
    AND existente."unidadesVendidas" = nueva.unidades_vendidas
);

-- Verificacion final
SELECT
  id,
  grupo,
  subgrupo,
  periodo,
  "unidadesVendidas",
  "comisionPorEquipo",
  "valorAproximado",
  orden,
  activo
FROM comisiones_configuracion
WHERE UPPER(TRIM(grupo)) = 'SUPERVISOR CALL CENTER'
  AND UPPER(TRIM(COALESCE(subgrupo, ''))) = '5 VENDEDORES'
  AND periodo = 'COMISION_SEMANAL'
ORDER BY orden, CAST("unidadesVendidas" AS NUMERIC);
