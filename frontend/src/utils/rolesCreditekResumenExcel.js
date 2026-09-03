import ExcelJS from "exceljs";

const COLORS = {
  navy: "FF17365D",
  white: "FFFFFFFF",
  text: "FF0F172A",
  muted: "FF64748B",
  line: "FFD8E0E8",
  slate: "FF475569",
  slateLight: "FFF1F5F9",
  green: "FF15803D",
  greenLight: "FFDCFCE7",
  greenText: "FF166534",
  rose: "FFBE123C",
  roseLight: "FFFFE4E6",
  roseText: "FF9F1239",
  blue: "FF2563EB",
  blueLight: "FFDBEAFE",
  blueText: "FF1E40AF",
  amber: "FFD97706",
  amberLight: "FFFEF3C7",
  amberText: "FF92400E",
  violet: "FF7C3AED",
};

const MONEY = '"$"#,##0.00';
const integer = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
const total = (items, getter) => Number(
  items.reduce((sum, item) => sum + integer(getter(item)), 0).toFixed(2),
);

const fill = (argb) => ({ type: "pattern", pattern: "solid", fgColor: { argb } });

const styleCell = (cell, options = {}) => {
  cell.fill = fill(options.fill || COLORS.white);
  cell.font = {
    name: "Arial",
    size: options.size || 9,
    bold: Boolean(options.bold),
    italic: Boolean(options.italic),
    color: { argb: options.color || COLORS.text },
  };
  cell.alignment = {
    horizontal: options.align || "left",
    vertical: "middle",
    wrapText: Boolean(options.wrap),
  };
  cell.border = {
    bottom: { style: "thin", color: { argb: options.border || COLORS.line } },
  };
  if (options.money) cell.numFmt = MONEY;
};

const setupSheet = ({ workbook, name, title, period, color, columns, freezeRow }) => {
  const worksheet = workbook.addWorksheet(name, {
    properties: { tabColor: { argb: color } },
    views: [{ state: "frozen", ySplit: freezeRow, showGridLines: false, zoomScale: 90 }],
  });
  worksheet.properties.defaultRowHeight = 20;
  worksheet.pageSetup = {
    orientation: "landscape",
    paperSize: 9,
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    printTitlesRow: `1:${freezeRow}`,
    margins: { left: 0.25, right: 0.25, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
  };
  worksheet.headerFooter.oddFooter = "&LResumen de roles&C&P de &N&RReporte interno";
  worksheet.mergeCells(1, 1, 1, columns);
  const titleCell = worksheet.getCell(1, 1);
  titleCell.value = title;
  styleCell(titleCell, { fill: COLORS.navy, color: COLORS.white, size: 16, bold: true });
  titleCell.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
  worksheet.getRow(1).height = 32;

  worksheet.mergeCells(2, 1, 2, columns);
  const subtitle = worksheet.getCell(2, 1);
  subtitle.value = `Periodo: ${period} | Generado desde Resumen Roles`;
  styleCell(subtitle, { fill: "FFF8FAFC", color: COLORS.muted, italic: true });
  subtitle.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
  worksheet.getRow(2).height = 22;

  worksheet.getRow(3).height = 5;
  for (let column = 1; column <= columns; column += 1) {
    worksheet.getCell(3, column).fill = fill(color);
  }
  return worksheet;
};

const addCards = (worksheet, cards, columns) => {
  const cells = cards.map((card, index) => {
    const start = Math.floor((index * columns) / cards.length) + 1;
    const end = Math.floor(((index + 1) * columns) / cards.length);
    worksheet.mergeCells(4, start, 4, end);
    worksheet.mergeCells(5, start, 5, end);
    const label = worksheet.getCell(4, start);
    label.value = card.label;
    styleCell(label, {
      fill: card.color,
      color: COLORS.white,
      size: 9,
      bold: true,
      align: "center",
    });
    const value = worksheet.getCell(5, start);
    styleCell(value, {
      fill: card.light,
      color: card.text,
      size: 16,
      bold: true,
      align: "center",
      money: card.money,
    });
    for (let row = 4; row <= 5; row += 1) {
      for (let column = start; column <= end; column += 1) {
        worksheet.getCell(row, column).border = {
          top: { style: "thin", color: { argb: COLORS.line } },
          bottom: { style: "thin", color: { argb: COLORS.line } },
          left: { style: "thin", color: { argb: COLORS.line } },
          right: { style: "thin", color: { argb: COLORS.line } },
        };
      }
    }
    return value;
  });
  worksheet.getRow(4).height = 19;
  worksheet.getRow(5).height = 30;
  worksheet.getRow(6).height = 9;
  return cells;
};

const styleHeader = (cell, color = COLORS.navy) => {
  styleCell(cell, {
    fill: color,
    color: COLORS.white,
    size: 9,
    bold: true,
    align: "center",
    wrap: true,
    border: COLORS.navy,
  });
};

const sumCell = (letter, startRow, endRow, result) =>
  startRow <= endRow
    ? { formula: `SUM(${letter}${startRow}:${letter}${endRow})`, result }
    : result;

const addTotalRow = ({ worksheet, firstRow, lastRow, columns, results, color }) => {
  const row = worksheet.addRow([]);
  row.height = 26;
  row.getCell(1).value = "TOTAL";
  for (let column = 1; column <= columns; column += 1) {
    const cell = row.getCell(column);
    styleCell(cell, {
      fill: column === columns ? color : COLORS.navy,
      color: COLORS.white,
      size: 10,
      bold: true,
      align: column === 1 ? "left" : "right",
      money: column > 1,
      border: COLORS.navy,
    });
    if (column > 1) {
      cell.value = sumCell(
        worksheet.getColumn(column).letter,
        firstRow,
        lastRow,
        results[column - 2] || 0,
      );
    }
  }
  return row;
};

const createIngresos = (workbook, data) => {
  const rows = data.ingresos || [];
  const worksheet = setupSheet({
    workbook,
    name: "Ingresos",
    title: "INGRESOS CREDITEK",
    period: data.period,
    color: COLORS.green,
    columns: 2,
    freezeRow: 7,
  });
  const cards = addCards(worksheet, [
    { label: "COLABORADORES", color: COLORS.slate, light: COLORS.slateLight, text: COLORS.slate },
    { label: "TOTAL INGRESOS", color: COLORS.green, light: COLORS.greenLight, text: COLORS.greenText, money: true },
  ], 2);
  worksheet.getRow(7).values = ["PERSONAL", "TOTAL COMISIONES SEMANA + MENSUAL"];
  worksheet.getRow(7).eachCell((cell) => styleHeader(cell, COLORS.green));
  worksheet.getRow(7).height = 28;
  const firstRow = 8;
  rows.forEach((item, index) => {
    const row = worksheet.addRow([item.nombre, integer(item.ingresos)]);
    row.height = 24;
    row.eachCell((cell, column) => styleCell(cell, {
      fill: index % 2 ? COLORS.slateLight : COLORS.white,
      bold: column === 1 || column === 2,
      align: column === 2 ? "right" : "left",
      money: column === 2,
    }));
  });
  const lastRow = worksheet.rowCount;
  const totalIngresos = total(rows, (item) => item.ingresos);
  const totalRow = addTotalRow({
    worksheet,
    firstRow,
    lastRow,
    columns: 2,
    results: [totalIngresos],
    color: COLORS.green,
  });
  cards[0].value = rows.length
    ? { formula: `COUNTA(A${firstRow}:A${lastRow})`, result: rows.length }
    : 0;
  cards[1].value = { formula: `B${totalRow.number}`, result: totalIngresos };
  worksheet.columns = [{ width: 36 }, { width: 31 }];
  worksheet.autoFilter = `A7:B${Math.max(7, lastRow)}`;
  worksheet.printArea = `A1:B${worksheet.rowCount}`;
};

const createEgresos = (workbook, data) => {
  const rows = data.egresos || [];
  const detailColumns = data.anticiposColumns || [];
  const loanColumns = data.prestamosColumns || [];
  const columns = 1 + detailColumns.length + 1 + loanColumns.length + 2;
  const worksheet = setupSheet({
    workbook,
    name: "Egresos",
    title: "EGRESOS CREDITEK",
    period: data.period,
    color: COLORS.rose,
    columns,
    freezeRow: 8,
  });
  const cards = addCards(worksheet, [
    { label: "COLABORADORES", color: COLORS.slate, light: COLORS.slateLight, text: COLORS.slate },
    { label: "TOTAL ANTICIPOS", color: COLORS.blue, light: COLORS.blueLight, text: COLORS.blueText, money: true },
    { label: "TOTAL PRESTAMOS", color: COLORS.green, light: COLORS.greenLight, text: COLORS.greenText, money: true },
    { label: "TOTAL DESCUENTOS", color: COLORS.rose, light: COLORS.roseLight, text: COLORS.roseText, money: true },
  ], columns);

  const totalAnticiposColumn = 2 + detailColumns.length;
  const firstLoanColumn = totalAnticiposColumn + 1;
  const totalLoansColumn = firstLoanColumn + loanColumns.length;
  const totalDiscountsColumn = totalLoansColumn + 1;
  worksheet.mergeCells(7, 1, 8, 1);
  worksheet.getCell(7, 1).value = "PERSONAL";
  worksheet.mergeCells(7, 2, 7, totalAnticiposColumn - 1);
  worksheet.getCell(7, 2).value = "ANTICIPOS Y DESCUENTOS";
  worksheet.mergeCells(7, totalAnticiposColumn, 8, totalAnticiposColumn);
  worksheet.getCell(7, totalAnticiposColumn).value = "TOTAL ANTICIPOS";
  worksheet.mergeCells(7, firstLoanColumn, 7, totalLoansColumn - 1);
  worksheet.getCell(7, firstLoanColumn).value = "PRESTAMOS A LA EMPRESA";
  worksheet.mergeCells(7, totalLoansColumn, 8, totalLoansColumn);
  worksheet.getCell(7, totalLoansColumn).value = "SUMAN PRESTAMOS";
  worksheet.mergeCells(7, totalDiscountsColumn, 8, totalDiscountsColumn);
  worksheet.getCell(7, totalDiscountsColumn).value = "TOTAL DESCUENTOS";
  for (let column = 1; column <= columns; column += 1) {
    styleHeader(worksheet.getCell(7, column), column >= firstLoanColumn && column <= totalLoansColumn ? COLORS.green : column === totalDiscountsColumn ? COLORS.rose : COLORS.blue);
  }
  detailColumns.forEach((column, index) => {
    const cell = worksheet.getCell(8, index + 2);
    cell.value = column.label.toUpperCase();
    styleHeader(cell, index === 0 || !column.calculated ? COLORS.amber : COLORS.blue);
  });
  loanColumns.forEach((column, index) => {
    const cell = worksheet.getCell(8, firstLoanColumn + index);
    cell.value = column.label.toUpperCase();
    styleHeader(cell, COLORS.green);
  });
  worksheet.getRow(7).height = 25;
  worksheet.getRow(8).height = 38;

  const firstRow = 9;
  rows.forEach((item, index) => {
    const values = [
      item.nombre,
      ...item.anticipos.map(integer),
      item.totalAnticipos,
      ...item.prestamos.map(integer),
      item.sumanPrestamos,
      item.totalDescuentos,
    ];
    const row = worksheet.addRow(values);
    const rowNumber = row.number;
    const detailEndLetter = worksheet.getColumn(totalAnticiposColumn - 1).letter;
    row.getCell(totalAnticiposColumn).value = {
      formula: `SUM(B${rowNumber}:${detailEndLetter}${rowNumber})`,
      result: integer(item.totalAnticipos),
    };
    row.getCell(totalLoansColumn).value = {
      formula: `SUM(${worksheet.getColumn(firstLoanColumn).letter}${rowNumber}:${worksheet.getColumn(totalLoansColumn - 1).letter}${rowNumber})`,
      result: integer(item.sumanPrestamos),
    };
    row.getCell(totalDiscountsColumn).value = {
      formula: `${worksheet.getColumn(totalAnticiposColumn).letter}${rowNumber}+${worksheet.getColumn(totalLoansColumn).letter}${rowNumber}`,
      result: integer(item.totalDescuentos),
    };
    row.height = 25;
    for (let column = 1; column <= columns; column += 1) {
      const derived = [totalAnticiposColumn, totalLoansColumn, totalDiscountsColumn].includes(column);
      const isLoan = column >= firstLoanColumn && column <= totalLoansColumn;
      styleCell(row.getCell(column), {
        fill: column === totalDiscountsColumn
          ? COLORS.roseLight
          : column === totalAnticiposColumn
            ? COLORS.blueLight
            : isLoan
              ? COLORS.greenLight
              : index % 2
                ? COLORS.slateLight
                : COLORS.white,
        bold: column === 1 || derived,
        color: column === totalDiscountsColumn
          ? COLORS.roseText
          : column === totalAnticiposColumn
            ? COLORS.blueText
            : isLoan
              ? COLORS.greenText
              : COLORS.text,
        align: column === 1 ? "left" : "right",
        money: column > 1,
      });
    }
  });
  const lastRow = worksheet.rowCount;
  const results = [];
  for (let column = 1; column < columns; column += 1) {
    results.push(total(rows, (item) => {
      if (column <= detailColumns.length) return item.anticipos[column - 1];
      if (column === totalAnticiposColumn - 1) return item.totalAnticipos;
      const loanIndex = column - totalAnticiposColumn;
      if (loanIndex >= 0 && loanIndex < loanColumns.length) return item.prestamos[loanIndex];
      if (column === totalLoansColumn - 1) return item.sumanPrestamos;
      return item.totalDescuentos;
    }));
  }
  const totalRow = addTotalRow({
    worksheet,
    firstRow,
    lastRow,
    columns,
    results,
    color: COLORS.rose,
  });
  cards[0].value = rows.length
    ? { formula: `COUNTA(A${firstRow}:A${lastRow})`, result: rows.length }
    : 0;
  cards[1].value = { formula: `${worksheet.getColumn(totalAnticiposColumn).letter}${totalRow.number}`, result: total(rows, (item) => item.totalAnticipos) };
  cards[2].value = { formula: `${worksheet.getColumn(totalLoansColumn).letter}${totalRow.number}`, result: total(rows, (item) => item.sumanPrestamos) };
  cards[3].value = { formula: `${worksheet.getColumn(totalDiscountsColumn).letter}${totalRow.number}`, result: total(rows, (item) => item.totalDescuentos) };
  worksheet.getColumn(1).width = 31;
  for (let column = 2; column <= columns; column += 1) worksheet.getColumn(column).width = 18;
  worksheet.autoFilter = `A8:${worksheet.getColumn(columns).letter}${Math.max(8, lastRow)}`;
  worksheet.printArea = `A1:${worksheet.getColumn(columns).letter}${worksheet.rowCount}`;
};

const createNomina = (workbook, data) => {
  const rows = data.nomina || [];
  const worksheet = setupSheet({
    workbook,
    name: "Nomina",
    title: "NOMINA CREDITEK",
    period: data.period,
    color: COLORS.violet,
    columns: 6,
    freezeRow: 7,
  });
  const cards = addCards(worksheet, [
    { label: "COLABORADORES", color: COLORS.slate, light: COLORS.slateLight, text: COLORS.slate },
    { label: "INGRESOS", color: COLORS.green, light: COLORS.greenLight, text: COLORS.greenText, money: true },
    { label: "EGRESOS", color: COLORS.rose, light: COLORS.roseLight, text: COLORS.roseText, money: true },
    { label: "TOTAL A PAGAR", color: COLORS.violet, light: "FFEDE9FE", text: "FF5B21B6", money: true },
  ], 6);
  const headers = ["PERSONAL", "INGRESOS", "EGRESOS", "NOMINA", "SUELDO", "TOTAL"];
  const headerColors = [COLORS.slate, COLORS.green, COLORS.rose, COLORS.blue, COLORS.amber, COLORS.violet];
  worksheet.getRow(7).values = headers;
  worksheet.getRow(7).eachCell((cell, column) => styleHeader(cell, headerColors[column - 1]));
  worksheet.getRow(7).height = 28;
  const firstRow = 8;
  rows.forEach((item, index) => {
    const row = worksheet.addRow([
      item.nombre,
      integer(item.ingresos),
      integer(item.egresos),
      integer(item.nomina),
      integer(item.sueldo),
      integer(item.total),
    ]);
    row.getCell(4).value = {
      formula: `B${row.number}-C${row.number}`,
      result: integer(item.nomina),
    };
    row.getCell(6).value = {
      formula: `D${row.number}+E${row.number}`,
      result: integer(item.total),
    };
    row.height = 25;
    for (let column = 1; column <= 6; column += 1) {
      const colorMap = {
        2: [COLORS.greenLight, COLORS.greenText],
        3: [COLORS.roseLight, COLORS.roseText],
        4: [COLORS.blueLight, COLORS.blueText],
        5: [COLORS.amberLight, COLORS.amberText],
        6: ["FFEDE9FE", "FF5B21B6"],
      };
      const tones = colorMap[column];
      styleCell(row.getCell(column), {
        fill: tones?.[0] || (index % 2 ? COLORS.slateLight : COLORS.white),
        color: tones?.[1] || COLORS.text,
        bold: column === 1 || column === 6,
        align: column === 1 ? "left" : "right",
        money: column > 1,
      });
    }
  });
  const lastRow = worksheet.rowCount;
  const results = [
    total(rows, (item) => item.ingresos),
    total(rows, (item) => item.egresos),
    total(rows, (item) => item.nomina),
    total(rows, (item) => item.sueldo),
    total(rows, (item) => item.total),
  ];
  const totalRow = addTotalRow({
    worksheet,
    firstRow,
    lastRow,
    columns: 6,
    results,
    color: COLORS.violet,
  });
  cards[0].value = rows.length
    ? { formula: `COUNTA(A${firstRow}:A${lastRow})`, result: rows.length }
    : 0;
  cards[1].value = { formula: `B${totalRow.number}`, result: results[0] };
  cards[2].value = { formula: `C${totalRow.number}`, result: results[1] };
  cards[3].value = { formula: `F${totalRow.number}`, result: results[4] };
  worksheet.columns = [
    { width: 32 },
    { width: 18 },
    { width: 18 },
    { width: 18 },
    { width: 18 },
    { width: 20 },
  ];
  worksheet.autoFilter = `A7:F${Math.max(7, lastRow)}`;
  worksheet.printArea = `A1:F${worksheet.rowCount}`;
};

export const crearLibroResumenRoles = (data, seccionId = null) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "RVE - Resumen Roles";
  workbook.company = "Creditek Ecuador";
  workbook.subject = "Resumen de ingresos, egresos y nomina";
  workbook.category = "Contabilidad";
  workbook.created = new Date();
  workbook.modified = new Date();
  workbook.calcProperties.fullCalcOnLoad = true;

  const creators = {
    ingresos: createIngresos,
    egresos: createEgresos,
    nomina: createNomina,
  };
  const sections = seccionId && creators[seccionId]
    ? [seccionId]
    : ["ingresos", "egresos", "nomina"];
  sections.forEach((section) => creators[section](workbook, data));
  return workbook;
};

const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export const descargarExcelResumenRoles = async (data, seccionId = null) => {
  const workbook = crearLibroResumenRoles(data, seccionId);
  const buffer = await workbook.xlsx.writeBuffer();
  const sectionNames = { ingresos: "Ingresos", egresos: "Egresos", nomina: "Nomina" };
  const section = seccionId && sectionNames[seccionId]
    ? `_${sectionNames[seccionId]}`
    : "";
  downloadBlob(
    new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    `Roles_Creditek${section}_${data.anio}_${String(data.mes).padStart(2, "0")}.xlsx`,
  );
};
