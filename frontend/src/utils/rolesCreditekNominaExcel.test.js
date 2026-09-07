import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { crearLibroNomina } from './rolesCreditekNominaExcel.js';

const filas = [
  { nombre: 'Persona prioritaria', cargo: 'Vendedor', cedula: '0012345678', fechaIngreso: '2025-01-05',
    salario: 482, diasTrabajados: 30, sueldoAPagar: 301.25, fondosReserva: 40.15,
    sueldosExtras: 12.34, comisionVenta: 0, totalIngresos: 353.74, iess: 45.55,
    anticipo: 183.5, prestamo: 50, sancionMeta: 0, totalEgresos: 279.05, valorRecibir: 74.69,
    diasMaternidad25: 15, diasSueldoCompleto: 15, sueldoMaternidadEmpresa: 60.25,
    subsidioIessInformativo: 180.75, tipoNovedad: 'MATERNIDAD', observacionNovedad: 'Primera línea\nSegunda línea',
    novedadesNomina: [{ id: 1, tipo: 'MATERNIDAD', fechaInicio: '2026-08-01', fechaFin: '2026-08-31', fechaRetorno: '2026-08-16' }] },
  { nombre: 'Otro empleado', cargo: null, cedula: null, salario: 482, diasTrabajados: 30,
    sueldoAPagar: 482, fondosReserva: 0, sueldosExtras: 0, comisionVenta: 0,
    totalIngresos: 482, iess: 45.55, anticipo: 0, prestamo: 0, sancionMeta: 0,
    totalEgresos: 45.55, valorRecibir: 436.45 },
];
const totales = { salario: 964, sueldoAPagar: 783.25, fondosReserva: 40.15, sueldosExtras: 12.34,
  comisionVenta: 0, totalIngresos: 835.74, iess: 91.1, anticipo: 183.5, prestamo: 50,
  sancionMeta: 0, totalEgresos: 324.6, valorRecibir: 511.14, diasMaternidad25: 15,
  diasSueldoCompleto: 45, sueldoMaternidadEmpresa: 60.25, subsidioIessInformativo: 180.75 };
const formatoFecha = (value) => value ? value.split('-').reverse().join('/') : '-';
const crear = () => crearLibroNomina({ filas, totales, periodoTexto: 'Desde el 1 al 31 de Agosto de 2026', formatoFecha });

test('el archivo generado conserva datos visibles, orden, cédulas, vacíos, novedades y totales', async () => {
  const original = JSON.stringify(filas);
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load(await crear().xlsx.writeBuffer());
  const hoja = libro.getWorksheet('Nomina');
  assert.equal(hoja.columnCount, 24);
  assert.equal(hoja.rowCount, 7);
  assert.equal(hoja.getCell('D5').value, 'PERSONA PRIORITARIA');
  assert.equal(hoja.getCell('D6').value, 'OTRO EMPLEADO');
  assert.equal(hoja.getCell('C5').value, '0012345678');
  assert.equal(hoja.getCell('C5').type, ExcelJS.ValueType.String);
  assert.equal(hoja.getCell('C6').value, '-');
  assert.equal(hoja.getCell('B5').value, '05/01/2025');
  assert.equal(hoja.getCell('J5').value, 12.34);
  assert.equal(hoja.getCell('J5').type, ExcelJS.ValueType.Number);
  assert.equal(hoja.getCell('K5').value, null);
  assert.equal(hoja.getCell('N6').value, null);
  assert.equal(hoja.getCell('O6').value, null);
  assert.equal(hoja.getCell('P5').value, 0);
  assert.equal(hoja.getCell('T6').value, 30);
  assert.equal(hoja.getCell('W5').value, 'MATERNIDAD\nMATERNIDAD: 01/08/2026 – 31/08/2026 · Retorno: 16/08/2026');
  assert.equal(hoja.getCell('X5').value, filas[0].observacionNovedad);
  assert.equal(hoja.getCell('E7').value, 'TOTALES');
  assert.equal(hoja.getCell('R7').value, 511.14);
  assert.equal(hoja.getCell('V7').value, 180.75);
  assert.equal(hoja.getCell('T7').value, 45);
  const texto = JSON.stringify(hoja.getSheetValues());
  assert.doesNotMatch(texto, /Editar|Guardar|Novedad de nómina|Mostrar primero|Subir|Bajar|★|↑|↓/);
  assert.equal(JSON.stringify(filas), original);
});

test('mantiene grupos de encabezados, bordes, colores y formatos después de guardar el xlsx', async () => {
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load(await crear().xlsx.writeBuffer());
  const hoja = libro.getWorksheet('Nomina');
  assert.equal(hoja.getCell('B3').value, 'DATOS');
  assert.equal(hoja.getCell('E3').master.address, 'B3');
  assert.equal(hoja.getCell('L3').master.address, 'F3');
  assert.equal(hoja.getCell('F3').value, 'INGRESOS');
  assert.equal(hoja.getCell('Q3').master.address, 'N3');
  assert.equal(hoja.getCell('N3').value, 'EGRESOS');
  assert.equal(hoja.getCell('M4').master.address, 'M3');
  assert.equal(hoja.getCell('N4').value, 'ANTICIPO');
  assert.equal(hoja.getCell('W3').value, 'NOVEDAD');
  assert.equal(hoja.getCell('X4').master.address, 'X3');
  assert.equal(hoja.getCell('L5').fill.fgColor.argb, 'FFD1FAE5');
  assert.equal(hoja.getCell('Q5').fill.fgColor.argb, 'FFFFF1F2');
  assert.equal(hoja.getCell('R5').fill.fgColor.argb, 'FFF0F9FF');
  assert.equal(hoja.getCell('R7').fill.fgColor.argb, 'FF0369A1');
  assert.equal(hoja.getCell('V7').fill.fgColor.argb, 'FF4338CA');
  assert.equal(hoja.getCell('J5').numFmt, '#,##0.00');
  assert.equal(hoja.getCell('J5').border.bottom.style, 'thin');
  assert.equal(hoja.getCell('W5').alignment.wrapText, true);
  assert.equal(hoja.views[0].ySplit, 4);
});
