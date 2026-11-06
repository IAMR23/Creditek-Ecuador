DO $$
DECLARE
  nicolas_id INTEGER;
  damian_id INTEGER;
BEGIN
  SELECT id INTO nicolas_id
  FROM usuarios
  WHERE nombre ILIKE '%Nicolas%Llerena%'
     OR nombre ILIKE '%Nicolás%Llerena%'
  ORDER BY activo DESC, id
  LIMIT 1;

  SELECT id INTO damian_id
  FROM usuarios
  WHERE nombre ILIKE '%Damian%Caiza%'
     OR nombre ILIKE '%Damián%Caiza%'
  ORDER BY activo DESC, id
  LIMIT 1;

  IF nicolas_id IS NULL THEN
    RAISE EXCEPTION 'No se encontro al usuario Nicolas Llerena';
  END IF;
  IF damian_id IS NULL THEN
    RAISE EXCEPTION 'No se encontro al usuario Damian Caiza';
  END IF;

  CREATE TEMP TABLE asignaciones_comerciales_objetivo ON COMMIT DROP AS
  WITH cargos_usuario AS (
    SELECT u.id AS "usuarioId", upper(rp.cargo) AS cargo
    FROM usuarios u
    JOIN roles_pago rp ON rp.id = u."rolPagoId"
    WHERE rp.activo = TRUE
    UNION
    SELECT urp.usuario_id, upper(rp.cargo)
    FROM usuarios_roles_pago urp
    JOIN roles_pago rp ON rp.id = urp.rol_pago_id
    WHERE rp.activo = TRUE
  ), equipos AS (
    SELECT
      u.id AS "usuarioId",
      CASE
        WHEN bool_or(c.cargo LIKE '%VENDEDOR%' AND c.cargo LIKE '%CALL CENTER%')
          THEN 'CALL CENTER'
        WHEN bool_or(c.cargo LIKE '%VENDEDOR%' AND c.cargo LIKE '%PISO%')
          THEN 'PISO'
        ELSE NULL
      END AS equipo
    FROM usuarios u
    JOIN cargos_usuario c ON c."usuarioId" = u.id
    WHERE u.activo = TRUE
      AND (u."fechaSalida" IS NULL OR u."fechaSalida" >= DATE '2026-09-01')
      AND u.id NOT IN (nicolas_id, damian_id)
    GROUP BY u.id
  )
  SELECT
    e."usuarioId",
    e.equipo,
    CASE WHEN e.equipo = 'PISO' THEN nicolas_id ELSE NULL END AS "jefeComercialId",
    CASE WHEN e.equipo = 'CALL CENTER' THEN damian_id ELSE NULL END AS "supervisorComercialId"
  FROM equipos e
  WHERE e.equipo IS NOT NULL;

  -- Conserva como pendiente la parte anterior a septiembre y captura el tramo
  -- comprobable que estaba vigente al comenzar la asignacion predeterminada.
  CREATE TEMP TABLE asignaciones_comerciales_cruce ON COMMIT DROP AS
  SELECT h.*
  FROM asignaciones_comerciales_historial h
  JOIN asignaciones_comerciales_objetivo o ON o."usuarioId" = h."usuarioId"
  JOIN usuarios u ON u.id = h."usuarioId"
  WHERE h."vigenciaDesde" < GREATEST(DATE '2026-09-01', COALESCE(u."fechaIngreso", DATE '2026-09-01'))
    AND (
      h."vigenciaHasta" IS NULL
      OR h."vigenciaHasta" >= GREATEST(DATE '2026-09-01', COALESCE(u."fechaIngreso", DATE '2026-09-01'))
    );

  UPDATE asignaciones_comerciales_historial h
  SET
    "vigenciaHasta" = GREATEST(DATE '2026-09-01', COALESCE(u."fechaIngreso", DATE '2026-09-01')) - 1,
    "updatedAt" = NOW()
  FROM asignaciones_comerciales_objetivo o, usuarios u
  WHERE h."usuarioId" = o."usuarioId"
    AND u.id = h."usuarioId"
    AND h."vigenciaDesde" < GREATEST(DATE '2026-09-01', COALESCE(u."fechaIngreso", DATE '2026-09-01'))
    AND (
      h."vigenciaHasta" IS NULL
      OR h."vigenciaHasta" >= GREATEST(DATE '2026-09-01', COALESCE(u."fechaIngreso", DATE '2026-09-01'))
    );

  UPDATE asignaciones_comerciales_historial h
  SET
    equipo = o.equipo,
    "jefeComercialId" = o."jefeComercialId",
    "supervisorComercialId" = o."supervisorComercialId",
    "requiereRevision" = FALSE,
    fuente = 'MIGRACION_REGLA_EQUIPO',
    observacion = 'Asignacion predeterminada confirmada desde septiembre de 2026.',
    "updatedAt" = NOW()
  FROM asignaciones_comerciales_objetivo o, usuarios u
  WHERE h."usuarioId" = o."usuarioId"
    AND u.id = h."usuarioId"
    AND h."vigenciaDesde" >= GREATEST(DATE '2026-09-01', COALESCE(u."fechaIngreso", DATE '2026-09-01'));

  INSERT INTO asignaciones_comerciales_historial (
    "usuarioId", "usuarioAgenciaId", "agenciaId", equipo,
    "jefeComercialId", "supervisorComercialId", "vigenciaDesde", "vigenciaHasta",
    "requiereRevision", fuente, observacion, "createdAt", "updatedAt"
  )
  SELECT
    c."usuarioId", c."usuarioAgenciaId", c."agenciaId", o.equipo,
    o."jefeComercialId", o."supervisorComercialId",
    GREATEST(DATE '2026-09-01', COALESCE(u."fechaIngreso", DATE '2026-09-01')),
    c."vigenciaHasta", FALSE, 'MIGRACION_REGLA_EQUIPO',
    'Asignacion predeterminada confirmada desde septiembre de 2026.', NOW(), NOW()
  FROM asignaciones_comerciales_cruce c
  JOIN asignaciones_comerciales_objetivo o ON o."usuarioId" = c."usuarioId"
  JOIN usuarios u ON u.id = c."usuarioId"
  WHERE NOT EXISTS (
    SELECT 1 FROM asignaciones_comerciales_historial existente
    WHERE existente."usuarioId" = c."usuarioId"
      AND existente."vigenciaDesde" = GREATEST(
        DATE '2026-09-01', COALESCE(u."fechaIngreso", DATE '2026-09-01')
      )
  );

  -- Si no existia un tramo comprobable al inicio, comienza en la primera
  -- relacion de agencia disponible, nunca antes del ingreso del vendedor.
  INSERT INTO asignaciones_comerciales_historial (
    "usuarioId", "usuarioAgenciaId", "agenciaId", equipo,
    "jefeComercialId", "supervisorComercialId", "vigenciaDesde", "vigenciaHasta",
    "requiereRevision", fuente, observacion, "createdAt", "updatedAt"
  )
  SELECT
    o."usuarioId", ua.id, ua."agenciaId", o.equipo,
    o."jefeComercialId", o."supervisorComercialId",
    GREATEST(
      DATE '2026-09-01',
      COALESCE(u."fechaIngreso", DATE '2026-09-01'),
      ua."createdAt"::date
    ),
    u."fechaSalida", FALSE, 'MIGRACION_REGLA_EQUIPO',
    'Asignacion predeterminada confirmada desde septiembre de 2026.', NOW(), NOW()
  FROM asignaciones_comerciales_objetivo o
  JOIN usuarios u ON u.id = o."usuarioId"
  JOIN LATERAL (
    SELECT relacion.*
    FROM usuario_agencia relacion
    WHERE relacion."usuarioId" = o."usuarioId"
    ORDER BY relacion.activo DESC, relacion."createdAt", relacion.id
    LIMIT 1
  ) ua ON TRUE
  WHERE NOT EXISTS (
    SELECT 1 FROM asignaciones_comerciales_historial h
    WHERE h."usuarioId" = o."usuarioId"
      AND (
        h."vigenciaHasta" IS NULL
        OR h."vigenciaHasta" >= DATE '2026-09-01'
      )
  );

  UPDATE usuarios u
  SET
    "jefeComercialId" = CASE
      WHEN o.equipo = 'PISO' THEN o."jefeComercialId"
      ELSE u."jefeComercialId"
    END,
    "supervisorComercialId" = CASE
      WHEN o.equipo = 'CALL CENTER' THEN o."supervisorComercialId"
      ELSE u."supervisorComercialId"
    END,
    "updatedAt" = NOW()
  FROM asignaciones_comerciales_objetivo o
  WHERE u.id = o."usuarioId";
END;
$$;

CREATE TABLE IF NOT EXISTS migracion_asignaciones_comerciales_202609 (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  "aplicadaAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
INSERT INTO migracion_asignaciones_comerciales_202609 (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

-- Verificacion posterior:
-- SELECT equipo, COUNT(*) FROM asignaciones_comerciales_historial
-- WHERE fuente = 'MIGRACION_REGLA_EQUIPO' GROUP BY equipo;
