-- Verificacion previa: muestra el estado actual del enum antes de ampliarlo.
SELECT enumlabel
FROM pg_enum
WHERE enumtypid = 'enum_ghl_workflow_ejecucion_detalles_estado'::regtype
ORDER BY enumsortorder;

ALTER TYPE enum_ghl_workflow_ejecucion_detalles_estado
  ADD VALUE IF NOT EXISTS 'processing' AFTER 'pending';

-- Verificacion posterior: processing debe aparecer una sola vez.
SELECT enumlabel
FROM pg_enum
WHERE enumtypid = 'enum_ghl_workflow_ejecucion_detalles_estado'::regtype
ORDER BY enumsortorder;
