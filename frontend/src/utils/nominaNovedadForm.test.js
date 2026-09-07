import test from 'node:test';
import assert from 'node:assert/strict';
import { formularioNovedad, novedadInicial } from './nominaNovedadForm.js';
const historial = [
  { id: 3, tipo: 'LACTANCIA', activo: true, fechaInicio: '2026-09-01', fechaFin: '2027-01-31' },
  { id: 2, tipo: 'MATERNIDAD', activo: false, fechaInicio: '2026-08-01', fechaFin: '2026-08-31' },
  { id: 1, tipo: 'MATERNIDAD', activo: true, fechaInicio: '2026-08-01', fechaFin: '2026-08-31', fechaRetorno: '2026-08-16', observacion: 'Corregir fechas', porcentajeEmpleador: 25, porcentajeIess: 75 },
];
test('abre para editar la novedad activa del mes en lugar de crear otra', () => {
  assert.equal(novedadInicial(historial, '2026-08').id, 1);
  assert.equal(novedadInicial(historial, '2026-09').id, 3);
});
test('permite elegir expresamente una novedad inactiva o de otro mes', () => {
  assert.equal(novedadInicial(historial, '2026-08', '2').id, 2);
  assert.equal(novedadInicial(historial, '2026-08', 3).id, 3);
  assert.equal(novedadInicial([historial[1]], '2026-08').id, 2);
});
test('inicia un registro nuevo cuando no existe novedad del mes', () => {
  assert.equal(novedadInicial([], '2026-08'), null);
  assert.equal(novedadInicial(historial, '2026-07'), null);
});
test('carga todos los campos editables y conserva cero y estado inactivo', () => {
  assert.deepEqual(formularioNovedad(historial[2]), { tipo: 'MATERNIDAD', fechaInicio: '2026-08-01', fechaFin: '2026-08-31', fechaRetorno: '2026-08-16', porcentajeEmpleador: 25, porcentajeIess: 75, activo: true, observacion: 'Corregir fechas' });
  assert.equal(formularioNovedad({ ...historial[1], porcentajeEmpleador: 0 }).porcentajeEmpleador, 0);
  assert.equal(formularioNovedad(historial[1]).activo, false);
});
