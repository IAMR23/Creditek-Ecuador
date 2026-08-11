-- Verificacion previa: confirma si el comentario de auditoria ya existe.
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'ventas'
  AND column_name = 'comentarioAuditoria';

ALTER TABLE ventas
ADD COLUMN IF NOT EXISTS "comentarioAuditoria" TEXT;

-- Verificacion posterior: muestra una muestra sin modificar datos historicos.
SELECT id, fecha, "comentarioAuditoria"
FROM ventas
ORDER BY id DESC
LIMIT 20;
