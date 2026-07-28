-- Verificación previa: usuarios que actualmente tienen un cargo salarial.
SELECT id, nombre, "rolPagoId"
FROM usuarios
WHERE "rolPagoId" IS NOT NULL
ORDER BY id;

-- Relación de múltiples cargos salariales por usuario.
CREATE TABLE IF NOT EXISTS usuarios_roles_pago (
  id SERIAL PRIMARY KEY,
  usuario_id INTEGER NOT NULL
    REFERENCES usuarios(id)
    ON UPDATE CASCADE
    ON DELETE CASCADE,
  rol_pago_id INTEGER NOT NULL
    REFERENCES roles_pago(id)
    ON UPDATE CASCADE
    ON DELETE CASCADE,
  CONSTRAINT usuarios_roles_pago_usuario_rol_unique
    UNIQUE (usuario_id, rol_pago_id)
);

CREATE INDEX IF NOT EXISTS usuarios_roles_pago_usuario_idx
  ON usuarios_roles_pago (usuario_id);

CREATE INDEX IF NOT EXISTS usuarios_roles_pago_rol_idx
  ON usuarios_roles_pago (rol_pago_id);

-- Conserva como asignación inicial el cargo principal de los usuarios existentes.
INSERT INTO usuarios_roles_pago (usuario_id, rol_pago_id)
SELECT id, "rolPagoId"
FROM usuarios
WHERE "rolPagoId" IS NOT NULL
ON CONFLICT (usuario_id, rol_pago_id) DO NOTHING;

-- Verificación final: cargos guardados por usuario y cargo principal compatible.
SELECT
  u.id AS usuario_id,
  u.nombre,
  u."rolPagoId" AS rol_pago_principal_id,
  ARRAY_AGG(urp.rol_pago_id ORDER BY urp.rol_pago_id)
    FILTER (WHERE urp.rol_pago_id IS NOT NULL) AS roles_pago_ids
FROM usuarios u
LEFT JOIN usuarios_roles_pago urp ON urp.usuario_id = u.id
GROUP BY u.id, u.nombre, u."rolPagoId"
ORDER BY u.id;
