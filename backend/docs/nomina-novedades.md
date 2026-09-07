# Novedades de maternidad y lactancia — RVE

Alcance: `backend/` y `frontend/`. No se cambia la nómina antigua ni sus asociaciones,
los cargos, las comisiones o los descuentos de personas sin novedad.

## Instalación

1. Aplicar `backend/migrations/202609070001-create-nomina-novedades.sql` contra la base RVE,
   con la conexión habitual ya configurada: `psql --set ON_ERROR_STOP=on --file=backend/migrations/202609070001-create-nomina-novedades.sql`.
2. Aplicar después `backend/migrations/202609070002-allow-edit-nomina-novedad-tipo.sql`.
   Permite corregir el tipo conservando los ajustes históricos sin usarlos en el cálculo.
3. Reiniciar el backend y publicar el frontend por el procedimiento habitual.
4. Actualizar Nómina. La acción **Novedad de nómina** aparece en cada empleado;
   cuando ya tiene una novedad del período aparece **Editar novedad**.

La migración es incremental, transaccional e idempotente. Crea `nomina_novedades`,
índice, restricciones y trigger, sin borrar tablas o registros. Incluye SELECT de
verificación antes y después. No requiere extensiones de PostgreSQL. El servicio
serializa altas y cambios mediante bloqueo de la fila del usuario y rechaza
maternidades activas superpuestas, incluidos límites coincidentes. El trigger
refuerza la validación para escrituras externas.

La migración **se aplicó el 7 de septiembre de 2026** al corregir el bloqueo de edición.
Se verificaron la tabla, el trigger y cero novedades iniciales. Se inspeccionó el esquema real
en modo lectura: las columnas históricas de fondos y extras existen, pero la tabla
de novedades no existía. Si falta la tabla, el resumen mantiene sus resultados y
devuelve `novedadesDisponibles: false`; las altas responden 503. El arranque actual
del proyecto usa `sequelize.sync`, por lo que se debe aplicar el SQL antes de
habilitar el módulo para contar también con todas las restricciones de base.

La segunda migración también se aplicó el 7 de septiembre de 2026. Se verificó
que se retiró el bloqueo de cambio de tipo y que el único registro existente
se conservó; no se modificaron datos de empleados.

## Datos y reglas

Cada novedad referencia `usuarios.id` (la nómina actual consolida por persona,
no por agencia). Guarda tipo, inicio, fin, retorno, porcentajes, observación,
estado activo, creador, actualizador y timestamps. No depende de nombres.

Los días se calculan exclusivamente con las fechas. Se retiraron del formulario
los campos de días manuales y la API rechaza nuevos valores manuales. El contenido
histórico de `ajustesMensuales` se conserva sin borrarlo, pero no interviene en el
cálculo. Los días completos son 30 menos los días
de maternidad del mes; múltiples novedades no pueden superar los 30 días.

Las fechas son inclusivas. El retorno termina el período reducido el día anterior;
desde el retorno se paga sueldo completo. El mes laboral tiene 30 días: el 31
no añade un día y el cierre de febrero completa 30. Esta convención se describe
en la función pura y está cubierta por pruebas.

El sueldo mensual usado por Roles Creditek sigue siendo su base actual de $482;
la función pura admite otras bases para reutilización. El trabajo no cambia esa
regla para otros empleados. Los porcentajes son configurables, inicialmente
25% empleador y 75% IESS, y deben sumar 100.

Para maternidad:

- Valor diario = sueldo mensual / 30.
- Sueldo completo = valor diario × días completos.
- Maternidad empresa = valor diario × días maternidad × porcentaje empleador / 100.
- Subsidio informativo = valor diario × días maternidad × porcentaje IESS / 100.
- Sueldo a pagar = sueldo completo + maternidad empresa.
- IESS personal = sueldo mensual completo × 9,45%; no incluye fondos ni subsidio.
- Fondos: conserva importe manual histórico, incluido cero. Sin ajuste y con el
  beneficio activo usa la base completa más los extras, dividida por 12.
- Ingresos empresa = sueldo a pagar + extras + fondos + comisiones existentes.
- Egresos = IESS personal + anticipos + préstamos + sanciones existentes.
- A recibir empresa = ingresos empresa − egresos. Subsidio nunca se suma a ese pago.

Lactancia es informativa, vigente desde su retorno o fecha de inicio. Mantiene
30 días y sueldo completo; no admite días reducidos manuales. Fuera de maternidad
se conserva la fórmula histórica de IESS de la aplicación.

Para corregir un registro, pulsar **Editar** junto a la novedad o **Editar novedad**
debajo del nombre. El formulario carga el registro seleccionado o la novedad activa
del período. El selector permite abrir otras novedades del historial o crear una nueva.
Se pueden cambiar tipo, fechas, porcentajes, observación y estado; **Guardar cambios**
actualiza el mismo registro, conserva su creador y registra quién realizó la corrección.

La edición de fechas y porcentajes afecta los meses comprendidos en la novedad;
verificar el rango antes de guardar. La distribución se recalcula por fechas en cada mes.
La interfaz permite abrir novedades con cambios pendientes de fondos/extras y los
incluye en la vista previa mediante importes validados por el backend. Guardar una
novedad conserva esos cambios en la tabla hasta pulsar Guardar todo. Guardar novedad
valida y recalcula aunque no se haya pulsado Vista previa. El cálculo definitivo y las validaciones
se ejecutan en el backend; la vista solo actualiza los campos manuales existentes.

## Endpoints

Todos heredan `authenticate` y `requirePermission("Contabilidad", "Administracion")`
del router `/api/contabilidad/roles-creditek-resumen`; no hay rutas públicas ni cambios JWT.

- `GET /novedades/:usuarioId`: historial activo e inactivo.
- `POST /novedades/preview`: validación y cálculo sin escritura.
- `POST /novedades`: crear novedad auditada.
- `PUT /novedades/:id`: editar o inactivar, incluido corregir el tipo; el empleado es inmutable.
- `GET /`: añade disponibilidad, novedades del mes y `nominaCalculada` para las
  personas con novedades; mantiene los campos anteriores del resumen.

La interfaz usa exclusivamente `frontend/src/api/client.js`. La exportación
conserva las 18 columnas anteriores y agrega 6: días de maternidad, días completos,
maternidad empresa, subsidio informativo, tipo y observación. Totales y Excel incluyen
todas las filas visibles con su orden; se retiraron las casillas de selección para sumar.
El total del subsidio está separado de los pagos.

## Prueba manual del caso de Naomi

1. Aplicar la migración y abrir Nómina en el período que corresponda. Buscar a Naomi.
2. Confirmar fondos históricos/manuales de $40,15, anticipo $183,50, préstamo $50
   y ausencia de otros extras/comisiones/sanciones para reproducir exactamente el ejemplo.
3. Abrir **Novedad de nómina**, elegir Maternidad y registrar sus fechas reales.
4. Para reproducir 15 días de maternidad y 15 completos en agosto, el ejemplo usa
   inicio 01/08 y final 15/08, o inicio 01/08 y retorno 16/08. Mantener porcentajes
   25/75. En el registro real deben usarse las fechas que correspondan a la empleada.
5. **Calcular vista previa**: sueldo $301,25; fondos $40,15; ingresos $341,40;
   IESS $45,55; egresos $279,05; pago Creditek $62,35; subsidio informativo $180,75.
6. Guardar y verificar la fila y Excel. Revisar que el subsidio no incremente el pago.
7. Registrar Lactancia con sus fechas reales desde el retorno y sin días manuales.
   En un mes de lactancia sin maternidad verificar 30 días y sueldo de $482.
8. Comparar una persona sin novedad: conservará exactamente sus cálculos previos.

No se creó una novedad real para Naomi ni se modificaron sus importes.

## Pruebas automatizadas

Solo unitarias y de servicio, sin E2E ni Playwright:

```powershell
cd backend
node --experimental-vm-modules node_modules/jest/bin/jest.js --runTestsByPath utils/nominaNovedades.test.js services/nominaNovedadesService.test.js services/rolesCreditekResumenService.test.js --runInBand
cd ../frontend
node --test src/utils/rolesCreditekNomina.test.js src/utils/nominaNovedadForm.test.js
node node_modules/eslint/bin/eslint.js src/pages/Contabilidad/NominaNovedadModal.jsx src/pages/Contabilidad/RolesCreditekNomina.jsx src/utils/rolesCreditekNomina.js
```

Archivos: modelo `NominaNovedad`, utilidad `nominaNovedades`, servicio y controlador
`nominaNovedadesService`/`nominaNovedadesController`, router y servicio de resumen,
modal y pantalla `RolesCreditekNomina`, utilidad frontend y sus pruebas; migración
y este documento. No se modifican `NominaEmpleado`, `RolCreditekAjuste`,
`nominaService`, `nominaRoutes` ni `Nomina.jsx`; fueron revisados para reutilizar
sus campos y evitar cambios en la nómina antigua.
