# Rol de descuentos Creditek — RVE

Pantalla: `/contabilidad/rol-descuentos-creditek`, dentro de Contabilidad → Roles Creditek.
API: `/api/contabilidad/rol-descuentos-creditek`.
Permisos: `authenticate` y `requirePermission("Contabilidad", "Administracion")`.

## Funcionamiento

- Registro manual por usuario, motivo y cuotas mensuales. Admite varios motivos para una persona y cuotas entre años.
- Cada cuota tiene importe y estado: pendiente, aplicado, recurrente o por revisar. Los estados son anotaciones de seguimiento; no ejecutan descuentos ni pagos automáticamente.
- Esta sección no suma sus cuotas automáticamente al Resumen roles ni a la nómina. Los registros existentes de Egresos y Roles Creditek conservan su funcionamiento.
- El período visible es configurable de 6 a 24 meses. Editar conserva todas las cuotas del motivo, incluidas las que no se ven en ese período.
- Archivar conserva el historial y permite restaurar el motivo desde el filtro Archivados.
- El Excel usa los registros filtrados y conserva los importes numéricos, años, colores, nombres agrupados y totales.
- La edición comprueba la versión del registro. Si otra persona ya lo cambió, devuelve HTTP 409 y exige recargar para evitar sobrescribirla.

## Base de datos

Modelo: `models/RolDescuentoCreditek.js`.
Tabla nueva: `roles_descuentos_creditek`.

El modelo se registra antes del `sequelize.sync({})` que ya utiliza el arranque de RVE; ese arranque puede crear la tabla ausente. No se agregó `alter` ni `force`.

Para instalaciones que aplican SQL previamente, usar `migrations/202609040002-create-rol-descuentos-creditek.sql`. Incluye verificación previa, creación idempotente y verificación posterior. No modifica datos existentes. No se ejecutó contra producción durante este cambio.

## Verificación

Desde `backend/`:

```powershell
node.exe node_modules/jest/bin/jest.js --runInBand services/rolDescuentosCreditekService.test.js routes/Contabilidad/rolDescuentosCreditekRoutes.test.js
```

Desde `frontend/`:

```powershell
node.exe --test src/utils/rolDescuentosCreditek.test.mjs
node.exe node_modules/eslint/bin/eslint.js src/pages/Contabilidad/RolDescuentosCreditek.jsx src/utils/rolDescuentosCreditek.js
```

Prueba manual:

1. Entrar con permiso de Contabilidad o Administración y abrir Rol de descuentos Creditek.
2. Crear un motivo para un usuario y generar cuotas desde diciembre por tres meses.
3. Verificar diciembre, enero y febrero con sus respectivos años. Editar un importe y estado, guardar y recargar.
4. Añadir otro motivo a la misma persona y verificar que el nombre quede agrupado y los totales coincidan.
5. Reducir el rango visible, editar el motivo y comprobar que las cuotas fuera del rango siguen registradas.
6. Archivar, filtrar Archivados y restaurar. Exportar el Excel y comparar valores y colores.
7. Editar el mismo registro desde dos sesiones y verificar que la segunda actualización avise del conflicto.

La compilación de la nueva pantalla y los cambios JSX de App y Sidebar se verificaron de forma acotada. La compilación completa de Vite y una revisión en navegador siguen pendientes; en la sesión no había navegador conectado y una compilación anterior agotaba la memoria disponible del equipo.
