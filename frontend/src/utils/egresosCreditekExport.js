import ExcelJS from "exceljs";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

const COLORES = {
  azul: "FF1E3A5F",
  blanco: "FFFFFFFF",
  gris: "FFF1F5F9",
  grisTexto: "FF475569",
  rojoClaro: "FFFFE4E6",
  rojoTexto: "FFBE123C",
  verdeClaro: "FFDCFCE7",
  verde: "FF15803D",
  verdeTexto: "FF166534",
};

const FORMATO_MONEDA = '"$"#,##0.00';
const FORMATO_FECHA = "yyyy-mm-dd";
const FORMATO_FECHA_HORA = "yyyy-mm-dd hh:mm";

export const SECCIONES_REPORTE_EGRESOS = [
  { id: "entradas", label: "Entradas", color: "FF059669" },
  { id: "cajas", label: "Cajas", color: "FF2563EB" },
  { id: "transferencias", label: "Transferencias", color: "FF0891B2" },
  { id: "descuentos", label: "Descuentos", color: "FFD97706" },
  { id: "jefes", label: "Jefes", color: "FF7C3AED" },
  { id: "multas_facturacion", label: "Multas facturacion", color: "FFE11D48" },
  { id: "otros", label: "Otros", color: "FF334155" },
];

const texto = (value, fallback = "") => {
  const normalizado = value == null ? "" : String(value).trim();
  return normalizado || fallback;
};

const numero = (value) => {
  const normalizado = Number(value);
  return Number.isFinite(normalizado) ? normalizado : 0;
};

const esControlFinanciero = (registro) =>
  registro?.origen === "CONTROL_FINANCIERO_CAJA";

const origenRegistro = (registro) =>
  esControlFinanciero(registro) ? "Control financiero" : "Manual";

const estadoRegistro = (registro) => {
  if (esControlFinanciero(registro)) {
    return texto(registro.estadoPagoEntrada, "PENDIENTE");
  }
  return registro?.activo === false ? "Inactivo" : "Activo";
};

const nombreUsuario = (registro) =>
  texto(
    registro?.usuario?.nombre,
    registro?.usuarioId ? `Usuario #${registro.usuarioId}` : "Sin responsable",
  );

const fechaBase = (seccionId, registro) =>
  seccionId === "jefes" && registro?.fecha
    ? registro.fecha
    : registro?.fecha || registro?.createdAt;

const fechaTexto = (value, incluirHora = false) => {
  if (!value) return "-";
  if (!incluirHora && /^\d{4}-\d{2}-\d{2}$/.test(String(value))) return String(value);

  const fecha = new Date(value);
  if (Number.isNaN(fecha.getTime())) return texto(value, "-");
  return fecha.toLocaleString("es-EC", {
    timeZone: "America/Guayaquil",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    ...(incluirHora ? { hour: "2-digit", minute: "2-digit", hour12: false } : {}),
  });
};

const fechaExcel = (value, incluirHora = false) => {
  if (!value) return "";
  const soloFecha = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (soloFecha) {
    return new Date(Date.UTC(
      Number(soloFecha[1]),
      Number(soloFecha[2]) - 1,
      Number(soloFecha[3]),
    ));
  }

  const fecha = new Date(value);
  if (Number.isNaN(fecha.getTime())) return texto(value);
  if (!incluirHora) return fecha;

  const partes = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Guayaquil",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
      .formatToParts(fecha)
      .filter((parte) => parte.type !== "literal")
      .map((parte) => [parte.type, parte.value]),
  );
  return new Date(Date.UTC(
    Number(partes.year),
    Number(partes.month) - 1,
    Number(partes.day),
    Number(partes.hour) % 24,
    Number(partes.minute),
  ));
};

const totalActivo = (registros) =>
  Number(
    registros
      .filter((registro) => registro?.activo !== false)
      .reduce((total, registro) => total + numero(registro?.valor), 0)
      .toFixed(2),
  );

const resumenRegistros = (registros) => {
  const activos = registros.filter((registro) => registro?.activo !== false).length;
  return {
    registros: registros.length,
    activos,
    inactivos: registros.length - activos,
    total: totalActivo(registros),
  };
};

const aplicarBordesSuaves = (cell) => {
  cell.border = {
    bottom: { style: "hair", color: { argb: "FFDCE3EA" } },
  };
};

const aplicarTarjetaResumen = (
  worksheet,
  { inicio, fin, label, fill, valueFill, valueColor },
) => {
  worksheet.mergeCells(4, inicio, 4, fin);
  worksheet.mergeCells(5, inicio, 5, fin);

  const labelCell = worksheet.getCell(4, inicio);
  labelCell.value = label;
  labelCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fill } };
  labelCell.font = {
    name: "Arial",
    size: 9,
    bold: true,
    color: { argb: COLORES.blanco },
  };
  labelCell.alignment = { horizontal: "center", vertical: "middle" };

  const valueCell = worksheet.getCell(5, inicio);
  valueCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: valueFill },
  };
  valueCell.font = {
    name: "Arial",
    size: 16,
    bold: true,
    color: { argb: valueColor },
  };
  valueCell.alignment = { horizontal: "center", vertical: "middle" };

  for (let row = 4; row <= 5; row += 1) {
    for (let column = inicio; column <= fin; column += 1) {
      worksheet.getCell(row, column).border = {
        top: { style: "thin", color: { argb: "FFD8E0E8" } },
        bottom: { style: "thin", color: { argb: "FFD8E0E8" } },
        left: { style: "thin", color: { argb: "FFD8E0E8" } },
        right: { style: "thin", color: { argb: "FFD8E0E8" } },
      };
    }
  }

  return valueCell;
};

const columnasExcel = (seccionId) => {
  if (seccionId === "cajas") {
    return [
      { label: "Fecha sancion", key: "fecha", width: 17, date: true },
      { label: "Origen", key: "origen", width: 20 },
      { label: "Contrato", key: "contrato", width: 18 },
      { label: "Cliente", key: "cliente", width: 30 },
      { label: "Vendedor", key: "vendedor", width: 24 },
      { label: "Modelo", key: "modelo", width: 23 },
      { label: "Responsable", key: "usuario", width: 25 },
      { label: "Valor", key: "valor", width: 15, currency: true },
      { label: "Estado", key: "estado", width: 16 },
      { label: "Incluido en total", key: "incluido", width: 18 },
      { label: "Observacion", key: "observacion", width: 40 },
      { label: "Registrado por", key: "registradoPor", width: 23 },
      { label: "Creado", key: "creado", width: 20, dateTime: true },
      { label: "Actualizado por", key: "actualizadoPor", width: 23 },
      { label: "Actualizado", key: "actualizado", width: 20, dateTime: true },
    ];
  }

  return [
    { label: "Fecha sancion", key: "fecha", width: 17, date: true },
    { label: "Usuario", key: "usuario", width: 28 },
    { label: "Valor", key: "valor", width: 15, currency: true },
    { label: "Estado", key: "estado", width: 15 },
    { label: "Incluido en total", key: "incluido", width: 18 },
    { label: "Observacion", key: "observacion", width: 45 },
    { label: "Registrado por", key: "registradoPor", width: 24 },
    { label: "Creado", key: "creado", width: 20, dateTime: true },
    { label: "Actualizado por", key: "actualizadoPor", width: 24 },
    { label: "Actualizado", key: "actualizado", width: 20, dateTime: true },
  ];
};

const filaExcel = (seccionId, registro) => ({
  fecha: fechaExcel(fechaBase(seccionId, registro)),
  origen: origenRegistro(registro),
  contrato: texto(registro?.contrato),
  cliente: texto(registro?.cliente),
  vendedor: texto(registro?.vendedor),
  modelo: texto(registro?.modelo),
  usuario: nombreUsuario(registro),
  valor: numero(registro?.valor),
  estado: estadoRegistro(registro),
  incluido: registro?.activo === false ? "No" : "Si",
  observacion: texto(registro?.observacion),
  registradoPor: texto(registro?.registradoPor?.nombre, "-"),
  creado: fechaExcel(registro?.createdAt, true),
  actualizadoPor: texto(registro?.actualizadoPor?.nombre, "-"),
  actualizado: fechaExcel(registro?.updatedAt, true),
});

const agregarHoja = (workbook, seccion, registros) => {
  const columnas = columnasExcel(seccion.id);
  const resumen = resumenRegistros(registros);
  const worksheet = workbook.addWorksheet(seccion.label, {
    properties: { tabColor: { argb: seccion.color } },
    views: [{ state: "frozen", ySplit: 7, showGridLines: false, zoomScale: 85 }],
  });
  worksheet.properties.defaultRowHeight = 20;
  worksheet.pageSetup = {
    orientation: "landscape",
    paperSize: 9,
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    printTitlesRow: "1:7",
    margins: { left: 0.25, right: 0.25, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
  };
  worksheet.headerFooter.oddFooter = "&LEgresos Creditek&C&P de &N&RReporte interno";

  worksheet.mergeCells(1, 1, 1, columnas.length);
  const titulo = worksheet.getCell(1, 1);
  titulo.value = `EGRESOS CREDITEK - ${seccion.label.toUpperCase()}`;
  titulo.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORES.azul } };
  titulo.font = { name: "Arial", size: 16, bold: true, color: { argb: COLORES.blanco } };
  titulo.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
  worksheet.getRow(1).height = 32;

  worksheet.mergeCells(2, 1, 2, columnas.length);
  const subtitulo = worksheet.getCell(2, 1);
  subtitulo.value = `Reporte detallado | Generado ${fechaTexto(new Date(), true)} | Zona horaria: Ecuador`;
  subtitulo.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
  subtitulo.font = {
    name: "Arial",
    size: 9,
    italic: true,
    color: { argb: COLORES.grisTexto },
  };
  subtitulo.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
  worksheet.getRow(2).height = 22;

  worksheet.getRow(3).height = 5;
  for (let column = 1; column <= columnas.length; column += 1) {
    worksheet.getCell(3, column).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: seccion.color },
    };
  }

  const tarjetas = [
    {
      label: "REGISTROS",
      fill: "FF475569",
      valueFill: "FFF1F5F9",
      valueColor: "FF334155",
    },
    {
      label: "ACTIVOS",
      fill: COLORES.verde,
      valueFill: COLORES.verdeClaro,
      valueColor: COLORES.verdeTexto,
    },
    {
      label: "INACTIVOS",
      fill: "FFBE123C",
      valueFill: COLORES.rojoClaro,
      valueColor: COLORES.rojoTexto,
    },
    {
      label: "TOTAL ACTIVO",
      fill: seccion.color,
      valueFill: "FFEFF6FF",
      valueColor: "FF1D4ED8",
    },
  ].map((tarjeta, index) => {
    const inicio = Math.floor((index * columnas.length) / 4) + 1;
    const fin = Math.floor(((index + 1) * columnas.length) / 4);
    return aplicarTarjetaResumen(worksheet, { ...tarjeta, inicio, fin });
  });
  worksheet.getRow(4).height = 19;
  worksheet.getRow(5).height = 30;
  worksheet.getRow(6).height = 9;

  const encabezado = worksheet.getRow(7);
  encabezado.values = columnas.map((columna) => columna.label);
  encabezado.height = 27;
  encabezado.eachCell({ includeEmpty: true }, (cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: seccion.color } };
    cell.font = { name: "Arial", size: 10, bold: true, color: { argb: COLORES.blanco } };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = {
      bottom: { style: "medium", color: { argb: COLORES.azul } },
    };
  });

  registros.forEach((registro, index) => {
    const valores = filaExcel(seccion.id, registro);
    const row = worksheet.addRow(columnas.map((columna) => valores[columna.key]));
    row.height = texto(registro?.observacion).length > 70 ? 34 : 24;
    row.eachCell({ includeEmpty: true }, (cell, columnNumber) => {
      const columna = columnas[columnNumber - 1];
      cell.font = {
        name: "Arial",
        size: 9,
        color: { argb: registro?.activo === false ? "FF64748B" : "FF0F172A" },
        bold: columna.currency,
      };
      cell.alignment = {
        horizontal: columna.currency
          ? "right"
          : ["estado", "incluido", "fecha"].includes(columna.key)
            ? "center"
            : "left",
        vertical: "middle",
        wrapText: ["observacion", "cliente"].includes(columna.key),
      };
      aplicarBordesSuaves(cell);
      if (registro?.activo === false) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF1F2" } };
      } else if (index % 2 === 1) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORES.gris } };
      }
      if (columna.currency) cell.numFmt = FORMATO_MONEDA;
      if (columna.date) cell.numFmt = FORMATO_FECHA;
      if (columna.dateTime) cell.numFmt = FORMATO_FECHA_HORA;
    });

    const estadoCell = row.getCell(columnas.findIndex((columna) => columna.key === "estado") + 1);
    const incluidoCell = row.getCell(
      columnas.findIndex((columna) => columna.key === "incluido") + 1,
    );
    const estado = estadoRegistro(registro).toUpperCase();
    const estadoPositivo = ["ACTIVO", "PAGADO"].includes(estado);
    const estadoPendiente = estado === "PENDIENTE";
    estadoCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: {
        argb: estadoPositivo
          ? COLORES.verdeClaro
          : estadoPendiente
            ? "FFFEF3C7"
            : COLORES.rojoClaro,
      },
    };
    estadoCell.font = {
      name: "Arial",
      size: 9,
      bold: true,
      color: {
        argb: estadoPositivo
          ? COLORES.verdeTexto
          : estadoPendiente
            ? "FF92400E"
            : COLORES.rojoTexto,
      },
    };
    incluidoCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: registro?.activo === false ? COLORES.rojoClaro : COLORES.verdeClaro },
    };
    incluidoCell.font = {
      name: "Arial",
      size: 9,
      bold: true,
      color: { argb: registro?.activo === false ? COLORES.rojoTexto : COLORES.verdeTexto },
    };
  });

  const primeraFila = 8;
  const ultimaFila = worksheet.rowCount;
  const columnaValor = columnas.findIndex((columna) => columna.key === "valor") + 1;
  const columnaIncluido = columnas.findIndex((columna) => columna.key === "incluido") + 1;

  if (registros.length) {
    const rangoIncluido = `${worksheet.getColumn(columnaIncluido).letter}${primeraFila}:${worksheet.getColumn(columnaIncluido).letter}${ultimaFila}`;
    const rangoValor = `${worksheet.getColumn(columnaValor).letter}${primeraFila}:${worksheet.getColumn(columnaValor).letter}${ultimaFila}`;
    tarjetas[0].value = {
      formula: `COUNTA(A${primeraFila}:A${ultimaFila})`,
      result: resumen.registros,
    };
    tarjetas[1].value = {
      formula: `COUNTIF(${rangoIncluido},"Si")`,
      result: resumen.activos,
    };
    tarjetas[2].value = {
      formula: `COUNTIF(${rangoIncluido},"No")`,
      result: resumen.inactivos,
    };
    tarjetas[3].value = {
      formula: `SUMIF(${rangoIncluido},"Si",${rangoValor})`,
      result: resumen.total,
    };
  } else {
    tarjetas.forEach((cell) => {
      cell.value = 0;
    });
  }
  tarjetas[3].numFmt = FORMATO_MONEDA;

  const filaTotal = worksheet.addRow([]);
  if (columnaValor > 1) worksheet.mergeCells(filaTotal.number, 1, filaTotal.number, columnaValor - 1);
  filaTotal.getCell(1).value = "TOTAL ACTIVO";
  filaTotal.getCell(1).alignment = { horizontal: "right", vertical: "middle" };
  filaTotal.getCell(columnaValor).value = registros.length
    ? {
        formula: `SUMIF(${worksheet.getColumn(columnaIncluido).letter}${primeraFila}:${worksheet.getColumn(columnaIncluido).letter}${ultimaFila},"Si",${worksheet.getColumn(columnaValor).letter}${primeraFila}:${worksheet.getColumn(columnaValor).letter}${ultimaFila})`,
        result: resumen.total,
      }
    : 0;
  filaTotal.getCell(columnaValor).numFmt = FORMATO_MONEDA;
  filaTotal.height = 24;
  for (let column = 1; column <= columnas.length; column += 1) {
    const cell = filaTotal.getCell(column);
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORES.azul } };
    cell.font = { name: "Arial", size: 10, bold: true, color: { argb: COLORES.blanco } };
  }
  filaTotal.getCell(columnaValor).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: seccion.color },
  };

  worksheet.columns.forEach((column, index) => {
    column.width = columnas[index].width;
  });
  worksheet.autoFilter = {
    from: { row: 7, column: 1 },
    to: { row: Math.max(7, ultimaFila), column: columnas.length },
  };
  worksheet.printArea = `A1:${worksheet.getColumn(columnas.length).letter}${worksheet.rowCount}`;
};

export const crearLibroEgresosCreditek = (datosSecciones) => {
  return crearLibroConSecciones(datosSecciones, SECCIONES_REPORTE_EGRESOS);
};

const crearLibroConSecciones = (datosSecciones, secciones) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "RVE - Egresos Creditek";
  workbook.company = "Creditek Ecuador";
  workbook.subject = "Reporte de egresos por rubro";
  workbook.category = "Contabilidad";
  workbook.created = new Date();
  workbook.modified = new Date();
  workbook.calcProperties.fullCalcOnLoad = true;

  secciones.forEach((seccion) => {
    const datos = datosSecciones.find((item) => item.id === seccion.id);
    agregarHoja(workbook, seccion, Array.isArray(datos?.registros) ? datos.registros : []);
  });
  return workbook;
};

const descargarBlob = (blob, nombreArchivo) => {
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = nombreArchivo;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const fechaNombreArchivo = () => {
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Guayaquil",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(new Date())
      .filter((parte) => parte.type !== "literal")
      .map((parte) => [parte.type, parte.value]),
  );
  return `${partes.year}-${partes.month}-${partes.day}`;
};

export const descargarExcelEgresosCreditek = async (datosSecciones) => {
  const workbook = crearLibroEgresosCreditek(datosSecciones);
  const buffer = await workbook.xlsx.writeBuffer();
  descargarBlob(
    new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    `Egresos_Creditek_${fechaNombreArchivo()}.xlsx`,
  );
};

export const crearLibroRubroEgresosCreditek = (datosSeccion) => {
  const seccion = SECCIONES_REPORTE_EGRESOS.find(
    (item) => item.id === datosSeccion?.id,
  );
  if (!seccion) throw new Error("El rubro solicitado no es valido.");

  return crearLibroConSecciones(
    [
      {
        ...seccion,
        registros: Array.isArray(datosSeccion?.registros)
          ? datosSeccion.registros
          : [],
      },
    ],
    [seccion],
  );
};

export const descargarExcelRubroEgresosCreditek = async (datosSeccion) => {
  const workbook = crearLibroRubroEgresosCreditek(datosSeccion);
  const buffer = await workbook.xlsx.writeBuffer();
  const fecha = fechaNombreArchivo();
  const nombreRubro = datosSeccion.label.replace(/\s+/g, "_");
  descargarBlob(
    new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    `Egresos_Creditek_${nombreRubro}_${fecha}.xlsx`,
  );
};

const filasPdf = (seccionId, registros) => {
  if (seccionId === "cajas") {
    return registros.map((registro) => [
      fechaTexto(fechaBase(seccionId, registro)),
      origenRegistro(registro),
      texto(registro?.contrato, "-"),
      texto(registro?.cliente, "-"),
      nombreUsuario(registro),
      `$${numero(registro?.valor).toFixed(2)}`,
      estadoRegistro(registro),
      texto(registro?.observacion, "-"),
    ]);
  }

  return registros.map((registro) => [
    fechaTexto(fechaBase(seccionId, registro)),
    nombreUsuario(registro),
    `$${numero(registro?.valor).toFixed(2)}`,
    estadoRegistro(registro),
    texto(registro?.observacion, "-"),
    texto(registro?.registradoPor?.nombre, "-"),
    fechaTexto(registro?.updatedAt || registro?.createdAt, true),
  ]);
};

const encabezadosPdf = (seccionId) =>
  seccionId === "cajas"
    ? [["Fecha sancion", "Origen", "Contrato", "Cliente", "Responsable", "Valor", "Estado", "Observacion"]]
    : [["Fecha sancion", "Usuario", "Valor", "Estado", "Observacion", "Registrado por", "Actualizado"]];

const dibujarEncabezadoPdf = (doc, seccion, registros) => {
  const ancho = doc.internal.pageSize.getWidth();
  doc.setFillColor(`#${seccion.color.slice(2)}`);
  doc.rect(0, 0, ancho, 24, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text(`EGRESOS CREDITEK - ${seccion.label.toUpperCase()}`, 14, 10);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(
    `${registros.length} registros | Total activo: $${totalActivo(registros).toFixed(2)}`,
    14,
    18,
  );
};

export const crearPdfEgresosCreditek = (datosSecciones) => {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  SECCIONES_REPORTE_EGRESOS.forEach((seccion, index) => {
    if (index > 0) doc.addPage("a4", "landscape");
    const datos = datosSecciones.find((item) => item.id === seccion.id);
    const registros = Array.isArray(datos?.registros) ? datos.registros : [];

    if (!registros.length) {
      dibujarEncabezadoPdf(doc, seccion, registros);
      doc.setTextColor(71, 85, 105);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.text("No existen registros en esta seccion.", 14, 39);
      return;
    }

    autoTable(doc, {
      startY: 30,
      margin: { top: 30, right: 10, bottom: 13, left: 10 },
      head: encabezadosPdf(seccion.id),
      body: filasPdf(seccion.id, registros),
      theme: "striped",
      styles: {
        font: "helvetica",
        fontSize: seccion.id === "cajas" ? 7 : 8,
        cellPadding: 1.8,
        overflow: "linebreak",
        valign: "middle",
        textColor: [15, 23, 42],
      },
      headStyles: {
        fillColor: [30, 58, 95],
        textColor: [255, 255, 255],
        fontStyle: "bold",
        halign: "center",
      },
      alternateRowStyles: { fillColor: [241, 245, 249] },
      columnStyles: seccion.id === "cajas"
        ? {
            0: { cellWidth: 21 },
            1: { cellWidth: 24 },
            2: { cellWidth: 24 },
            3: { cellWidth: 42 },
            4: { cellWidth: 40 },
            5: { cellWidth: 20, halign: "right" },
            6: { cellWidth: 22, halign: "center" },
            7: { cellWidth: "auto" },
          }
        : {
            0: { cellWidth: 24 },
            1: { cellWidth: 42 },
            2: { cellWidth: 23, halign: "right" },
            3: { cellWidth: 22, halign: "center" },
            4: { cellWidth: "auto" },
            5: { cellWidth: 40 },
            6: { cellWidth: 34 },
          },
      didDrawPage: () => dibujarEncabezadoPdf(doc, seccion, registros),
    });
  });

  const paginas = doc.getNumberOfPages();
  for (let pagina = 1; pagina <= paginas; pagina += 1) {
    doc.setPage(pagina);
    const ancho = doc.internal.pageSize.getWidth();
    const alto = doc.internal.pageSize.getHeight();
    doc.setDrawColor(203, 213, 225);
    doc.line(10, alto - 9, ancho - 10, alto - 9);
    doc.setTextColor(100, 116, 139);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(`Generado: ${fechaTexto(new Date(), true)}`, 10, alto - 4.5);
    doc.text(`Pagina ${pagina} de ${paginas}`, ancho - 10, alto - 4.5, { align: "right" });
  }
  return doc;
};

export const descargarPdfEgresosCreditek = (datosSecciones) => {
  const doc = crearPdfEgresosCreditek(datosSecciones);
  doc.save(`Egresos_Creditek_${fechaNombreArchivo()}.pdf`);
};
