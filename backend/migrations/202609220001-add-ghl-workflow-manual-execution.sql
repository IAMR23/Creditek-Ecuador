-- Verificacion previa del tipo de ejecucion.
SELECT enumlabel
FROM pg_enum
WHERE enumtypid = 'enum_ghl_workflow_ejecuciones_tipo'::regtype
ORDER BY enumsortorder;

ALTER TYPE enum_ghl_workflow_ejecuciones_tipo
  ADD VALUE IF NOT EXISTS 'manual' AFTER 'scheduled';

-- Verificacion posterior: manual debe aparecer una sola vez.
SELECT enumlabel
FROM pg_enum
WHERE enumtypid = 'enum_ghl_workflow_ejecuciones_tipo'::regtype
ORDER BY enumsortorder;
