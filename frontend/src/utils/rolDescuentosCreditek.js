export const MESES_DESCUENTOS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
export const ESTADOS_DESCUENTOS = {
  PENDIENTE: { label: "Pendiente", color: "FFFFFF" },
  APLICADO: { label: "Aplicado", color: "00B050" },
  RECURRENTE: { label: "Recurrente", color: "FFFF00" },
  REVISAR: { label: "Por revisar", color: "E879F9" },
};
export const mesesDesde = (inicio, cantidad) => {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(inicio)) return [];
  const [anio, mes] = inicio.split("-").map(Number);
  return Array.from({ length: cantidad }, (_, index) => {
    const fecha = new Date(Date.UTC(anio, mes - 1 + index, 1));
    return { key: fecha.toISOString().slice(0, 7), mes: fecha.getUTCMonth(), anio: fecha.getUTCFullYear() };
  });
};
export const colorCuota = (cuota, mes) => cuota && cuota.estado !== "PENDIENTE"
  ? ESTADOS_DESCUENTOS[cuota.estado]?.color || "FFFFFF"
  : mes === 11 ? "FBBF24" : "FFFFFF";
export const agruparDescuentos = (registros, busqueda = "") => {
  const normalizar = (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const buscar = normalizar(busqueda.trim());
  const grupos = new Map();
  registros.forEach((row) => {
    if (buscar && !normalizar(`${row.usuario?.nombre} ${row.motivo}`).includes(buscar)) return;
    if (!grupos.has(row.usuarioId)) grupos.set(row.usuarioId, { usuarioId: row.usuarioId, nombre: row.usuario?.nombre || "Sin nombre", filas: [] });
    grupos.get(row.usuarioId).filas.push({ ...row, cuotasPorMes: Object.fromEntries(row.cuotas.map((cuota) => [cuota.periodo, cuota])) });
  });
  return [...grupos.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
};
export const totalesDescuentos = (grupos, meses) => Object.fromEntries(meses.map(({ key }) => [key,
  grupos.reduce((sum, grupo) => sum + grupo.filas.reduce((total, fila) => total + Math.round(Number(fila.cuotasPorMes[key]?.valor || 0) * 100), 0), 0) / 100,
]));

export const crearExcelDescuentos = async (grupos, meses) => {
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Rol descuentos Creditek");
  const columns = meses.length + 2;
  sheet.mergeCells(1, 1, 1, columns);
  sheet.getCell(1, 1).value = "ROL DE DESCUENTOS CREDITEK";
  sheet.getCell(1, 1).font = { bold: true, size: 14 };
  sheet.getCell(1, 1).alignment = { horizontal: "center" };
  sheet.getRow(1).height = 28;
  sheet.addRow(["NOMBRE", "MOTIVO", ...meses.map((mes) => `${MESES_DESCUENTOS[mes.mes].toUpperCase()} ${mes.anio}`)]);
  sheet.getColumn(1).width = 28;
  sheet.getColumn(2).width = 32;
  meses.forEach((_mes, index) => { sheet.getColumn(index + 3).width = 16; });
  const style = (cell, color = "FFFFFF", bold = false) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${color}` } };
    cell.font = { name: "Arial", size: 10, bold };
    cell.alignment = { vertical: "middle", wrapText: true, horizontal: cell.col < 3 ? "left" : "right" };
    cell.border = Object.fromEntries(["top", "bottom", "left", "right"].map((side) => [side, { style: "thin", color: { argb: "FF000000" } }]));
  };
  sheet.getRow(2).eachCell((cell, column) => style(cell, meses[column - 3]?.mes === 11 ? "FBBF24" : "E2E8F0", true));
  grupos.forEach((grupo) => {
    const primera = sheet.rowCount + 1;
    grupo.filas.forEach((fila) => {
      const row = sheet.addRow([grupo.nombre.toUpperCase(), fila.motivo.toUpperCase(), ...meses.map((mes) => fila.cuotasPorMes[mes.key]?.valor ?? null)]);
      row.height = 24;
      for (let col = 1; col <= columns; col += 1) {
        const mes = meses[col - 3];
        const cuota = mes && fila.cuotasPorMes[mes.key];
        const cell = row.getCell(col);
        style(cell, mes ? colorCuota(cuota, mes.mes) : "FFFFFF", col === 2);
        if (mes) cell.numFmt = '"$"#,##0.00';
        if (cuota) cell.note = ESTADOS_DESCUENTOS[cuota.estado]?.label || "Pendiente";
      }
    });
    if (grupo.filas.length > 1) sheet.mergeCells(primera, 1, sheet.rowCount, 1);
  });
  const totales = totalesDescuentos(grupos, meses);
  const totalRow = sheet.addRow(["TOTAL", "", ...meses.map((mes) => totales[mes.key])]);
  totalRow.eachCell((cell) => { style(cell, "E2E8F0", true); if (cell.col > 2) cell.numFmt = '"$"#,##0.00'; });
  sheet.addRow([]);
  sheet.addRow(["Colores", "Verde: aplicado · Amarillo: recurrente · Violeta: por revisar · Diciembre: naranja"]);
  sheet.views = [{ state: "frozen", xSplit: 2, ySplit: 2 }];
  return workbook;
};
