import ExcelJS from "exceljs";

const AZUL = "FF1F4E78";
const VERDE = "FF70AD47";
const ROJO = "FFC00000";
const BLANCO = "FFFFFFFF";
const GRIS = "FFF2F2F2";
const MONEDA = '"$"#,##0.00';

const texto = (value) => (value == null ? "" : String(value));
const numero = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const aplicarEncabezado = (row, color = AZUL) => {
  row.height = 22;
  row.eachCell({ includeEmpty: true }, (cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: color } };
    cell.font = { bold: true, color: { argb: BLANCO } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = {
      bottom: { style: "thin", color: { argb: "FFD9E2F3" } },
    };
  });
};

const aplicarTitulo = (worksheet, titulo, contexto, ultimaColumna) => {
  worksheet.mergeCells(1, 1, 1, ultimaColumna);
  const tituloCell = worksheet.getCell(1, 1);
  tituloCell.value = titulo;
  tituloCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: VERDE } };
  tituloCell.font = { bold: true, size: 15, color: { argb: BLANCO } };
  tituloCell.alignment = { horizontal: "center", vertical: "middle" };
  worksheet.getRow(1).height = 27;

  worksheet.mergeCells(2, 1, 2, ultimaColumna);
  const contextoCell = worksheet.getCell(2, 1);
  contextoCell.value = contexto;
  contextoCell.font = { italic: true, color: { argb: "FF475569" } };
  contextoCell.alignment = { horizontal: "left", vertical: "middle" };
  worksheet.getRow(2).height = 20;
};

const aplicarTotal = (row) => {
  row.eachCell({ includeEmpty: true }, (cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ROJO } };
    cell.font = { bold: true, color: { argb: BLANCO } };
  });
};

const prepararHoja = (worksheet) => {
  worksheet.properties.defaultRowHeight = 19;
  worksheet.pageSetup = {
    orientation: "landscape",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    paperSize: 9,
  };
  worksheet.headerFooter.oddFooter = "Página &P de &N";
};

const agregarTotalVentas = (
  worksheet,
  encabezados,
  primeraFila,
  ultimaFila,
  totales,
) => {
  const fila = worksheet.addRow([]);
  const columnaVentas = encabezados.indexOf("VENTAS") + 1;
  const columnaEntradas = encabezados.indexOf("ENTRADAS") + 1;
  fila.getCell(columnaVentas - 1).value = "TOTAL";
  fila.getCell(columnaVentas).value = primeraFila <= ultimaFila
    ? {
        formula: `SUM(${worksheet.getColumn(columnaVentas).letter}${primeraFila}:${worksheet.getColumn(columnaVentas).letter}${ultimaFila})`,
        result: numero(totales.ventas),
      }
    : 0;
  fila.getCell(columnaEntradas).value = primeraFila <= ultimaFila
    ? {
        formula: `SUM(${worksheet.getColumn(columnaEntradas).letter}${primeraFila}:${worksheet.getColumn(columnaEntradas).letter}${ultimaFila})`,
        result: numero(totales.entradas),
      }
    : 0;
  fila.getCell(columnaVentas).numFmt = MONEDA;
  fila.getCell(columnaEntradas).numFmt = MONEDA;
  aplicarTotal(fila);
};

const crearHojaVentas = ({
  workbook,
  nombre,
  titulo,
  contexto,
  registros,
  celular = false,
}) => {
  const worksheet = workbook.addWorksheet(nombre, {
    views: [{ state: "frozen", ySplit: 3 }],
  });
  prepararHoja(worksheet);
  const encabezados = celular
    ? [
        "CONTRATO",
        "FECHA",
        "VENDEDOR",
        "CLIENTE",
        "MODELO",
        "IMEI",
        "VENTAS",
        "ENTRADAS",
      ]
    : [
        "CONTRATO",
        "FECHA",
        "VENDEDOR",
        "CLIENTE",
        "MODELO",
        "VENTAS",
        "ENTRADAS",
      ];
  aplicarTitulo(worksheet, titulo, contexto, encabezados.length);
  const encabezado = worksheet.addRow(encabezados);
  aplicarEncabezado(encabezado);
  const primeraFila = worksheet.rowCount + 1;

  registros.forEach((registro, index) => {
    const valores = [
      texto(registro.contrato),
      texto(registro.fecha),
      texto(registro.vendedor),
      texto(registro.cliente),
      texto(registro.modelo),
      ...(celular ? [texto(registro.imei)] : []),
      numero(registro.ventas),
      numero(registro.entradas),
    ];
    const row = worksheet.addRow(valores);
    if (index % 2 === 1) {
      row.eachCell((cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GRIS } };
      });
    }
  });

  const ultimaFila = worksheet.rowCount;
  const columnaVentas = encabezados.indexOf("VENTAS") + 1;
  const columnaEntradas = encabezados.indexOf("ENTRADAS") + 1;
  worksheet.getColumn(1).numFmt = "@";
  if (celular) worksheet.getColumn(6).numFmt = "@";
  worksheet.getColumn(columnaVentas).numFmt = MONEDA;
  worksheet.getColumn(columnaEntradas).numFmt = MONEDA;
  worksheet.autoFilter = {
    from: { row: encabezado.number, column: 1 },
    to: { row: Math.max(encabezado.number, ultimaFila), column: encabezados.length },
  };
  agregarTotalVentas(
    worksheet,
    encabezados,
    primeraFila,
    ultimaFila,
    {
      ventas: registros.reduce((total, item) => total + numero(item.ventas), 0),
      entradas: registros.reduce(
        (total, item) => total + numero(item.entradas),
        0,
      ),
    },
  );

  const widths = celular
    ? [18, 22, 22, 36, 28, 22, 16, 16]
    : [18, 22, 22, 36, 28, 16, 16];
  worksheet.columns.forEach((column, index) => {
    column.width = widths[index];
    column.alignment = { vertical: "middle", wrapText: true };
  });
  return worksheet;
};

const agregarSeccionCuotas = (worksheet, producto, registros) => {
  worksheet.addRow([]);
  const filaTitulo = worksheet.addRow([producto]);
  worksheet.mergeCells(filaTitulo.number, 1, filaTitulo.number, 9);
  aplicarEncabezado(filaTitulo, VERDE);

  const encabezados = [
    "CONTRATO",
    "FECHA",
    "VENDEDOR",
    "USUARIO COBRADOR",
    "CLIENTE",
    "PAGOS CUOTAS",
    "Nro CUOTAS",
    "AGENCIA",
    "ARCHIVO",
  ];
  const filaEncabezado = worksheet.addRow(encabezados);
  aplicarEncabezado(filaEncabezado);
  const primeraFila = worksheet.rowCount + 1;

  registros.forEach((registro, index) => {
    const row = worksheet.addRow([
      texto(registro.contrato),
      texto(registro.fecha),
      texto(registro.vendedor),
      texto(registro.usuarioCobrador),
      texto(registro.cliente),
      numero(registro.pagosCuotas),
      texto(registro.numeroCuotas),
      texto(registro.agencia),
      texto(registro.archivoOrigen),
    ]);
    if (index % 2 === 1) {
      row.eachCell((cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GRIS } };
      });
    }
  });

  const ultimaFila = worksheet.rowCount;
  const filaTotal = worksheet.addRow([]);
  filaTotal.getCell(5).value = "TOTAL";
  filaTotal.getCell(6).value = primeraFila <= ultimaFila
    ? {
        formula: `SUM(F${primeraFila}:F${ultimaFila})`,
        result: registros.reduce(
          (total, registro) => total + numero(registro.pagosCuotas),
          0,
        ),
      }
    : 0;
  filaTotal.getCell(6).numFmt = MONEDA;
  aplicarTotal(filaTotal);
};

const crearHojaCaja = ({ workbook, contexto, registros, resumenCaja }) => {
  const worksheet = workbook.addWorksheet("Caja", {
    views: [{ state: "frozen", ySplit: 5 }],
  });
  prepararHoja(worksheet);
  aplicarTitulo(
    worksheet,
    "CONTROL FINANCIERO - REPORTES DE CAJA",
    contexto,
    9,
  );

  const filaResumen = worksheet.addRow(["RESUMEN GENERAL"]);
  worksheet.mergeCells(filaResumen.number, 1, filaResumen.number, 4);
  aplicarEncabezado(filaResumen, VERDE);
  const encabezado = worksheet.addRow(["AGENCIA", "UPHONE", "CREDITV", "TOTAL"]);
  aplicarEncabezado(encabezado);
  const primeraFilaResumen = worksheet.rowCount + 1;

  resumenCaja.filas.forEach((fila) => {
    const row = worksheet.addRow([
      fila.agencia,
      numero(fila.uphone),
      numero(fila.creditv),
      numero(fila.total),
    ]);
    row.getCell(2).numFmt = MONEDA;
    row.getCell(3).numFmt = MONEDA;
    row.getCell(4).numFmt = MONEDA;
  });

  const ultimaFilaResumen = worksheet.rowCount;
  const filaTotal = worksheet.addRow(["TOTAL"]);
  [2, 3, 4].forEach((column) => {
    const letter = worksheet.getColumn(column).letter;
    filaTotal.getCell(column).value = {
      formula: `SUM(${letter}${primeraFilaResumen}:${letter}${ultimaFilaResumen})`,
      result: numero(
        column === 2
          ? resumenCaja.total.uphone
          : column === 3
            ? resumenCaja.total.creditv
            : resumenCaja.total.total,
      ),
    };
    filaTotal.getCell(column).numFmt = MONEDA;
  });
  aplicarTotal(filaTotal);

  ["CREDITV", "UPHONE"].forEach((producto) => {
    agregarSeccionCuotas(
      worksheet,
      producto,
      registros.filter(
        (registro) => String(registro.producto || "").toUpperCase() === producto,
      ),
    );
  });

  const widths = [18, 22, 22, 20, 36, 16, 16, 18, 42];
  worksheet.columns.forEach((column, index) => {
    column.width = widths[index];
    column.alignment = { vertical: "middle", wrapText: true };
  });
  worksheet.getColumn(1).numFmt = "@";
  worksheet.getColumn(6).numFmt = MONEDA;
  return worksheet;
};

export const crearLibroControlFinanciero = ({
  tipo,
  registros,
  resumenCaja,
  contexto,
}) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "RVE - Control Financiero";
  workbook.created = new Date();
  workbook.modified = new Date();

  if (tipo === "caja") {
    crearHojaCaja({ workbook, contexto, registros, resumenCaja });
  } else if (tipo === "ventasTv") {
    crearHojaVentas({
      workbook,
      nombre: "Ventas TV",
      titulo: "CONTROL FINANCIERO - VENTAS TV",
      contexto,
      registros,
    });
  } else if (tipo === "ventasCelular") {
    crearHojaVentas({
      workbook,
      nombre: "Ventas Celular",
      titulo: "CONTROL FINANCIERO - VENTAS CELULAR",
      contexto,
      registros,
      celular: true,
    });
  } else {
    throw new Error("Tipo de reporte no soportado.");
  }

  return workbook;
};

export const crearNombreExcelControlFinanciero = ({
  tipo,
  carga,
  consolidado,
  filtros,
}) => {
  const tipos = {
    caja: "CAJA",
    ventasTv: "VENTAS_TV",
    ventasCelular: "VENTAS_CELULAR",
  };
  const tipoArchivo = tipos[tipo] || "REPORTE";

  if (consolidado) {
    const desde = filtros?.fechaInicio || "INICIO";
    const hasta = filtros?.fechaFin || "ACTUAL";
    return `CONTROL_FINANCIERO_${tipoArchivo}_CONSOLIDADO_${desde}_A_${hasta}.xlsx`;
  }

  const fecha = carga?.fechaReporte || "SIN_FECHA";
  return `CONTROL_FINANCIERO_${tipoArchivo}_CARGA_${carga?.id || "SIN_ID"}_${fecha}.xlsx`;
};
