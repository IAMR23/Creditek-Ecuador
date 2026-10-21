import ExcelJS from 'exceljs';

export const ENCABEZADOS_NOMINA = [
  'FECHA DE INGRESO', 'CEDULAS', 'NOMBRES Y APELLIDOS', 'CARGO',
  'SALARIO', 'DIAS TRABAJADAS', 'DÍAS DE FALTA', 'SUELDO A PAGAR', 'FONDOS RESERVA',
  'SUELDOS EXTRAS', 'COMxVTA', 'TOTAL INGRESOS',
  'ANTICIPO', 'PRESTAMO', 'SANCIÓN POR NO LLEGAR A META', 'TOTAL EGRESOS',
];
export const ENCABEZADOS_NOVEDAD = [
  'DÍAS MATERNIDAD', 'DÍAS SUELDO COMPLETO', 'MATERNIDAD EMPRESA',
  'SUBSIDIO IESS (INFORMATIVO)', 'NOVEDAD', 'OBSERVACIÓN NOVEDAD',
];

const fondo = (argb) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });
const borde = { style: 'thin', color: { argb: 'FF020617' } };
const monetarias = [6, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 22, 23];
const camposTotales = {
  6: 'salario', 8: 'diasFalta', 9: 'sueldoAPagar', 10: 'fondosReserva', 11: 'sueldosExtras',
  12: 'comisionVenta', 13: 'totalIngresos', 14: 'iess', 15: 'anticipo',
  16: 'prestamo', 17: 'sancionMeta', 18: 'totalEgresos', 19: 'valorRecibir',
  20: 'diasMaternidad25', 21: 'diasSueldoCompleto',
  22: 'sueldoMaternidadEmpresa', 23: 'subsidioIessInformativo',
};

// Recibe las mismas filas calculadas, filtradas y ordenadas y los totales de la pantalla.
// Los controles de edición y orden no forman parte de los datos del archivo.
export function crearLibroNomina({ filas, totales, periodoTexto, formatoFecha }) {
  const libro = new ExcelJS.Workbook();
  const hoja = libro.addWorksheet('Nomina', {
    views: [{ state: 'frozen', ySplit: 4, showGridLines: false }],
    pageSetup: { orientation: 'landscape', paperSize: 8, fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  [6, 16, 16, 42, 30, 14, 14, 14, 16, 16, 16, 14, 17, 16, 14, 14, 22, 17, 18, 17, 20, 20, 24, 54, 50]
    .forEach((width, i) => { hoja.getColumn(i + 1).width = width; });
  hoja.mergeCells('A1:Y1');
  hoja.getCell('A1').value = 'Nomina';
  hoja.getCell('A1').font = { name: 'Calibri', size: 18, bold: true, color: { argb: 'FF020617' } };
  hoja.getRow(1).height = 28;
  hoja.mergeCells('A2:Y2');
  hoja.getCell('A2').value = periodoTexto.toUpperCase();
  hoja.getCell('A2').font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF475569' } };
  hoja.getRow(2).height = 24;
  for (let r = 3; r <= 4; r += 1) {
    hoja.getRow(r).height = r === 3 ? 32 : 42;
    for (let c = 1; c <= 25; c += 1) {
      const celda = hoja.getCell(r, c);
      celda.fill = fondo('FFE0F2FE');
      celda.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF020617' } };
      celda.border = { top: borde, bottom: borde, left: borde, right: borde };
      celda.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    }
  }
  const encabezado = (rango, texto, color) => {
    hoja.mergeCells(rango);
    const celda = hoja.getCell(rango.split(':')[0]);
    celda.value = texto;
    if (color) celda.fill = fondo(color);
  };
  encabezado('A3:A4', 'N#');
  encabezado('B3:E3', 'DATOS', 'FFBAE6FD');
  encabezado('F3:M3', 'INGRESOS', 'FFBAE6FD');
  encabezado('N3:N4', '9,45%\nIESS/15DIAS', 'FFBAE6FD');
  encabezado('O3:R3', 'EGRESOS', 'FFBAE6FD');
  encabezado('S3:S4', 'VALOR\nA RECIBIR', 'FF7DD3FC');
  ENCABEZADOS_NOMINA.forEach((texto, i) => { hoja.getCell(4, i < 12 ? i + 2 : i + 3).value = texto; });
  ENCABEZADOS_NOVEDAD.forEach((texto, i) => {
    const columna = hoja.getColumn(i + 20).letter;
    encabezado(`${columna}3:${columna}4`, texto);
  });
  filas.forEach((fila, i) => {
    const novedad = fila.tipoNovedad ? [
      fila.tipoNovedad === 'LACTANCIA' ? 'Lactancia' : fila.tipoNovedad,
      ...(fila.novedadesNomina || []).map((item) =>
        `${item.tipo}: ${formatoFecha(item.fechaInicio)} – ${formatoFecha(item.fechaFin)}${item.fechaRetorno ? ` · Retorno: ${formatoFecha(item.fechaRetorno)}` : ''}`),
    ].join('\n') : '';
    const row = hoja.addRow([
      i + 1, formatoFecha(fila.fechaIngreso), String(fila.cedula || '-'),
      String(fila.nombre || '').toUpperCase(), String(fila.cargo || '-').toUpperCase(),
      fila.salario, fila.diasTrabajados, fila.diasFalta || 0, fila.sueldoAPagar, fila.fondosReserva,
      fila.sueldosExtras, fila.comisionVenta || null, fila.totalIngresos, fila.iess,
      fila.anticipo || null, fila.prestamo || null, fila.sancionMeta, fila.totalEgresos,
      fila.valorRecibir, fila.diasMaternidad25 || 0, fila.diasSueldoCompleto ?? fila.diasTrabajados,
      fila.sueldoMaternidadEmpresa || 0, fila.subsidioIessInformativo || 0,
      novedad, fila.observacionNovedad || '',
    ]);
    row.height = Math.max(30, ...[fila.nombre, fila.cargo, novedad, fila.observacionNovedad].map((texto, indice) =>
      String(texto || '').split('\n').reduce((lineas, linea) => lineas + Math.max(1, Math.ceil(linea.length / [36, 26, 46, 44][indice])), 0) * 15 + 8));
    for (let c = 1; c <= 25; c += 1) {
      const celda = row.getCell(c);
      celda.fill = fondo(({ 13: 'FFD1FAE5', 17: 'FFFFF1F2', 18: 'FFFFF1F2', 19: 'FFF0F9FF', 23: 'FFEEF2FF' })[c] || (i % 2 === 0 ? 'FFF3FCF8' : 'FFFFFFFF'));
      celda.font = { name: 'Calibri', size: 10, bold: c <= 19 || c === 23,
        color: { argb: ({ 17: 'FF9F1239', 19: 'FF0C4A6E', 23: 'FF3730A3' })[c] || 'FF020617' } };
      celda.border = { top: borde, bottom: borde, left: borde, right: borde };
      celda.alignment = { horizontal: [1, 2, 3, 7, 8].includes(c) ? 'center' : [4, 5, 24, 25].includes(c) ? 'left' : 'right', vertical: 'middle', wrapText: true };
      celda.numFmt = monetarias.includes(c) ? '#,##0.00' : c === 3 ? '@' : '0';
    }
  });
  const total = hoja.addRow(Array.from({ length: 25 }, (_, i) => i === 4 ? 'TOTALES' : camposTotales[i + 1] ? totales[camposTotales[i + 1]] : null));
  total.height = 30;
  for (let c = 1; c <= 25; c += 1) {
    const celda = total.getCell(c);
    celda.fill = fondo(c === 23 ? 'FF4338CA' : 'FF0369A1');
    celda.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    celda.border = { top: borde, bottom: borde, left: borde, right: borde };
    celda.alignment = { horizontal: c === 5 ? 'left' : 'right', vertical: 'middle' };
    celda.numFmt = monetarias.includes(c) ? '#,##0.00' : '0';
  }
  hoja.pageSetup.printTitlesRow = '3:4';
  hoja.pageSetup.printArea = `A1:Y${total.number}`;
  return libro;
}
