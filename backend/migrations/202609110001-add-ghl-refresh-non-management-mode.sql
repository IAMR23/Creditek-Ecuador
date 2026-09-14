-- Verificacion previa: debe devolver los modos actualmente registrados.
SELECT enumlabel
FROM pg_enum
WHERE enumtypid = 'enum_ghl_reparto_configuraciones_modo'::regtype
ORDER BY enumsortorder;

-- Cambio seguro y compatible con las configuraciones existentes.
ALTER TYPE enum_ghl_reparto_configuraciones_modo
  ADD VALUE IF NOT EXISTS 'refresh_non_management';

-- Verificacion posterior: debe incluir refresh_non_management.
SELECT enumlabel
FROM pg_enum
WHERE enumtypid = 'enum_ghl_reparto_configuraciones_modo'::regtype
ORDER BY enumsortorder;

-- PostgreSQL no permite retirar de forma segura un valor ENUM en uso.
