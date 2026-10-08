-- Conserva una sola matriz activa para Supervisor de Call Center.
-- La matriz historica sin rol queda inactiva para no perder trazabilidad.
WITH rol_supervisor AS (
  SELECT id, cargo
  FROM roles_pago
  WHERE UPPER(TRIM(cargo)) = 'SUPERVISOR DE CALL CENTER'
    AND activo = TRUE
  ORDER BY id
  LIMIT 1
)
UPDATE comisiones_configuracion AS configuracion
SET
  "rolPagoId" = rol_supervisor.id,
  grupo = rol_supervisor.cargo,
  "updatedAt" = NOW()
FROM rol_supervisor
WHERE UPPER(TRIM(configuracion.grupo)) = 'SUPERVISOR DE CALL CENTER';

UPDATE comisiones_configuracion
SET
  activo = FALSE,
  "updatedAt" = NOW()
WHERE UPPER(TRIM(grupo)) = 'SUPERVISOR CALL CENTER';

-- Completa la matriz vinculada al rol solamente cuando falta un escalon.
WITH rol_supervisor AS (
  SELECT id, cargo
  FROM roles_pago
  WHERE UPPER(TRIM(cargo)) = 'SUPERVISOR DE CALL CENTER'
    AND activo = TRUE
  ORDER BY id
  LIMIT 1
), reglas (
  subgrupo,
  periodo,
  unidades_vendidas,
  comision_por_equipo,
  promedio_por_vendedor,
  bono,
  orden
) AS (
  VALUES
    ('2 vendedores', 'COMISION_SEMANAL', '26', 1.5000, NULL, NULL, 1),
    ('3 vendedores', 'COMISION_SEMANAL', '38', 1.5000, NULL, NULL, 0),
    ('3 vendedores', 'COMISION_SEMANAL', '43', 1.0000, NULL, NULL, 0),
    ('3 vendedores', 'COMISION_SEMANAL', '51', 3.0000, NULL, NULL, 0),
    ('4 vendedores', 'COMISION_SEMANAL', '50', 1.5000, NULL, NULL, 0),
    ('4 vendedores', 'COMISION_SEMANAL', '56', 2.0000, NULL, NULL, 0),
    ('4 vendedores', 'COMISION_SEMANAL', '66', 3.0000, NULL, NULL, 0),
    ('5 vendedores', 'COMISION_SEMANAL', '62', 1.5000, NULL, NULL, 0),
    ('5 vendedores', 'COMISION_SEMANAL', '71', 2.0000, NULL, NULL, 0),
    ('6 vendedores', 'COMISION_SEMANAL', '64', 1.5000, NULL, NULL, 0),
    ('6 vendedores', 'COMISION_SEMANAL', '84', 2.0000, NULL, NULL, 0),
    ('6 vendedores', 'COMISION_SEMANAL', '90', 3.0000, NULL, NULL, 0),
    ('2 vendedores', 'BONO_MENSUAL', NULL, NULL, '12', 60.00, 5),
    ('2 vendedores', 'BONO_MENSUAL', NULL, NULL, '13', 80.00, 6),
    ('2 vendedores', 'BONO_MENSUAL', NULL, NULL, '15', 100.00, 7)
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
  rol_supervisor.id,
  rol_supervisor.cargo,
  reglas.subgrupo,
  reglas.periodo,
  reglas.unidades_vendidas,
  reglas.comision_por_equipo,
  NULL,
  reglas.promedio_por_vendedor,
  reglas.bono,
  NULL,
  'Matriz unica de Supervisor de Call Center',
  reglas.orden,
  TRUE,
  NOW(),
  NOW()
FROM rol_supervisor
CROSS JOIN reglas
WHERE NOT EXISTS (
  SELECT 1
  FROM comisiones_configuracion AS existente
  WHERE existente."rolPagoId" = rol_supervisor.id
    AND existente.periodo = reglas.periodo
    AND UPPER(TRIM(COALESCE(existente.subgrupo, ''))) =
        UPPER(TRIM(COALESCE(reglas.subgrupo, '')))
    AND COALESCE(existente."unidadesVendidas", '') =
        COALESCE(reglas.unidades_vendidas, '')
    AND COALESCE(existente."promedioPorVendedor", '') =
        COALESCE(reglas.promedio_por_vendedor, '')
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'pagos_comisiones_equipos_cantidad_vendedores_check'
      AND conrelid = 'pagos_comisiones_equipos_semanales'::regclass
  ) THEN
    ALTER TABLE pagos_comisiones_equipos_semanales
      ADD CONSTRAINT pagos_comisiones_equipos_cantidad_vendedores_check
      CHECK (
        "cantidadVendedoresComision" IS NULL
        OR "cantidadVendedoresComision" BETWEEN 1 AND 6
      );
  END IF;
END $$;

