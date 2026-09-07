/* eslint-disable react/prop-types */
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import Swal from "sweetalert2";
import ExcelJS from "exceljs";
import {
  AlertTriangle,
  BadgeDollarSign,
  CalendarDays,
  CalendarCog,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Lock,
  RefreshCw,
  Save,
  Search,
  Truck,
  X,
} from "lucide-react";
import { api } from "../../api/client";

const ENDPOINT = "/api/contabilidad/pagos-comisiones";

const MONTHS = [
  { value: 1, label: "Enero" },
  { value: 2, label: "Febrero" },
  { value: 3, label: "Marzo" },
  { value: 4, label: "Abril" },
  { value: 5, label: "Mayo" },
  { value: 6, label: "Junio" },
  { value: 7, label: "Julio" },
  { value: 8, label: "Agosto" },
  { value: 9, label: "Septiembre" },
  { value: 10, label: "Octubre" },
  { value: 11, label: "Noviembre" },
  { value: 12, label: "Diciembre" },
];

const blockColors = [
  "bg-orange-200",
  "bg-amber-100",
  "bg-orange-200",
  "bg-yellow-300",
  "bg-rose-500 text-white",
];

const moneyFormatter = new Intl.NumberFormat("es-EC", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const commissionFormatter = new Intl.NumberFormat("es-EC", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 3,
});

const currentDate = new Date();
const padDatePart = (value) => String(value).padStart(2, "0");
const toInputDate = (date) =>
  `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}`;

const initialFilters = {
  year: currentDate.getFullYear(),
  month: currentDate.getMonth() + 1,
};

const getCalendarMonthRange = ({ year, month }) => {
  const numericYear = Number(year);
  const monthIndex = Number(month) - 1;
  return {
    fechaInicio: toInputDate(new Date(numericYear, monthIndex, 1)),
    fechaFin: toInputDate(new Date(numericYear, monthIndex + 1, 0)),
  };
};

const initialLogisticaFilters = getCalendarMonthRange(initialFilters);

const emptyWeekValues = {
  venden: 0,
  valorVendido: 0,
  totalComisiones: 0,
  noCumpleMetas: 0,
  valorDescontar: 0,
};

const emptyMonthlyValues = {
  ventasTvCelulaMensual: 0,
  valorComisionSemanal: 0,
  valorComisionMensual: 0,
  totalComisionesSemanaMensual: 0,
  totalNoCumpleMetas: 0,
  totalValorDescontar: 0,
  totalPagar: 0,
};

const SHOW_GOAL_COMPLIANCE_SECTION = false;
const WEEK_COLUMN_COUNT = SHOW_GOAL_COMPLIANCE_SECTION ? 4 : 3;
const MONTHLY_COLUMN_COUNT = SHOW_GOAL_COMPLIANCE_SECTION ? 5 : 4;

const getWeekValues = (row, week) => row?.semanas?.[week.startDate] || emptyWeekValues;
const getMonthlyValues = (row) => row?.resumenMensual || emptyMonthlyValues;
const getPenaltyWeekValues = (row, week) => {
  const values = getWeekValues(row, week);
  if (
    values.semanaFutura ||
    values.semanaLaborada === false ||
    values.semanaCompletaParaDescuento === false
  ) {
    return { ...values, noCumpleMetas: 0, valorDescontar: 0 };
  }
  return values;
};
const getPenaltyTotal = (row, weeks) =>
  roundMoney(weeks.reduce(
    (sum, week) => sum + Number(getPenaltyWeekValues(row, week).valorDescontar || 0),
    0,
  ));
const isPersonalNuevoEnReporte = (row, weeks) =>
  weeks.some((week) => getWeekValues(row, week).personalNuevo);
const getFechaIngresoVisible = (row) =>
  row?.fechaIngreso || row?.fechaCreacionUsuario || null;
const getCargosPagoLabel = (row) =>
  (row?.cargosPago || [])
    .map((position) => position.cargo)
    .filter(Boolean)
    .join(" / ");

const formatMoney = (value) => moneyFormatter.format(Number(value || 0));
const formatCommission = (value) => commissionFormatter.format(Number(value || 0));
const formatCurrency = (value) =>
  `$${Number(value || 0).toLocaleString("es-EC", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
const VALOR_DESCUENTO_INPUT_REGEX = /^\d+(?:\.\d{0,2})?$/;
const esFormatoValorDescuentoInputValido = (value) => {
  const texto = String(value ?? "");
  return texto === "" || VALOR_DESCUENTO_INPUT_REGEX.test(texto);
};
const parseValorDescuentoInput = (value) => {
  const texto = String(value ?? "").trim();
  if (!texto || !VALOR_DESCUENTO_INPUT_REGEX.test(texto)) return null;
  const numero = Number(texto);
  return Number.isFinite(numero) && numero >= 0 && numero <= 9999999999.99
    ? numero
    : null;
};
const roundMoney = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  return date.toLocaleDateString("es-EC", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};
const normalizeSearchText = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
const toDateKey = (value) => (value ? String(value).slice(0, 10) : null);
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const parseDateKey = (value) => {
  const dateKey = toDateKey(value);
  if (!dateKey) return null;
  const date = new Date(`${dateKey}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
};
const debeMostrarPorPermanencia = (row) => {
  const ingreso = parseDateKey(row?.fechaIngreso || row?.fechaCreacionUsuario);
  const salida = parseDateKey(row?.fechaSalida);
  if (!ingreso || !salida) return true;

  const diasTrabajados = Math.floor(
    (salida.getTime() - ingreso.getTime()) / MS_PER_DAY,
  );
  if (diasTrabajados < 0) return true;
  return diasTrabajados > 10;
};
const filtrarPorPermanencia = (rows = []) =>
  rows.filter((row) => debeMostrarPorPermanencia(row));
const isSellerAvailableForWeek = (seller, week) => {
  if (Array.isArray(seller?.semanasDisponiblesEquipo)) {
    return seller.semanasDisponiblesEquipo
      .map((weekStart) => String(weekStart).slice(0, 10))
      .includes(String(week?.startDate || "").slice(0, 10));
  }

  const inicioSemana = toDateKey(week?.startDate);
  const finSemana = toDateKey(week?.endDate);
  const fechaIngreso = toDateKey(seller?.fechaIngreso || seller?.fechaCreacionUsuario);
  const fechaSalida = toDateKey(seller?.fechaSalida);
  if (!inicioSemana || !finSemana) return true;
  if (fechaIngreso && fechaIngreso > finSemana) return false;
  if (fechaSalida && fechaSalida < inicioSemana) return false;
  return true;
};
const addDays = (date, days) => {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  copy.setDate(copy.getDate() + days);
  return copy;
};
const toDateOnly = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const getFirstThursdayOfYear = (year) => {
  const firstDay = new Date(Number(year), 0, 1);
  const daysSinceThursday = (firstDay.getDay() - 4 + 7) % 7;
  return addDays(firstDay, -daysSinceThursday);
};
const buildCalendarPreview = (year, meses) => {
  let startDate = getFirstThursdayOfYear(year);
  return meses.map((mes) => {
    const cantidadSemanas = Number(mes.cantidadSemanas || 0);
    const fechaInicio = toDateOnly(startDate);
    const endDate = addDays(startDate, cantidadSemanas * 7 - 1);
    startDate = addDays(endDate, 1);
    return {
      ...mes,
      fechaInicio,
      fechaFin: toDateOnly(endDate),
    };
  });
};
const isPastCommercialMonth = (year, month) =>
  Number(year) < currentDate.getFullYear() ||
  (Number(year) === currentDate.getFullYear() &&
    Number(month) < currentDate.getMonth() + 1);
const getCargosComerciales = (vendedor) => {
  const cargos = (vendedor.cargosPago || [])
    .map((position) => position.cargo)
    .filter(Boolean);
  if (vendedor.cargoComision) cargos.push(vendedor.cargoComision);
  if (vendedor.cargo) cargos.push(vendedor.cargo);
  return [...new Set(cargos.map((cargo) => String(cargo).toUpperCase()))];
};
const cumpleFiltroCargo = (vendedor, cargoFiltro) => {
  const cargos = getCargosComerciales(vendedor);
  if (cargoFiltro === "CALL_CENTER") {
    return cargos.some((cargo) => cargo.includes("CALL CENTER"));
  }
  if (cargoFiltro === "PISO") {
    return cargos.some((cargo) => cargo.includes("PISO"));
  }
  return true;
};

const getSeccionPorCargo = (cargoValue) => {
  const cargo = String(cargoValue || "").toUpperCase();
  if (cargo.includes("JEFE COMERCIAL")) return "JEFES";
  if (cargo.includes("SUPERVISOR")) return "SUPERVISORES";
  if (cargo.includes("VENDEDOR")) return "VENDEDORES";
  return null;
};

const getSeccionCargo = (vendedor) =>
  getSeccionPorCargo(vendedor.cargoComision || vendedor.cargo);

const perteneceASeccion = (vendedor, seccion) => {
  const seccionCargo = seccion === "SANCIONES" ? "VENDEDORES" : seccion;
  if (
    (seccion === "JEFES" || seccion === "SUPERVISORES") &&
    vendedor.activo === false
  ) {
    return false;
  }

  return getCargosComerciales(vendedor).some(
    (cargo) => getSeccionPorCargo(cargo) === seccionCargo,
  );
};

const getVendedorParaSeccion = (vendedor, seccion) => {
  if (
    !["VENDEDORES", "SANCIONES"].includes(seccion) ||
    !vendedor.ventasPersonalesVendedor
  ) {
    return vendedor;
  }

  const vistaPersonal = vendedor.ventasPersonalesVendedor;
  const semanas = Object.fromEntries(
    Object.entries(vistaPersonal.semanas || {}).map(([semanaInicio, values]) => {
      const valuesPagoPrincipal = vendedor.semanas?.[semanaInicio] || {};
      return [
        semanaInicio,
        {
          ...values,
          noCumpleMetas:
            valuesPagoPrincipal.noCumpleMetas ?? values.noCumpleMetas,
          valorMultaCalculado:
            valuesPagoPrincipal.valorMultaCalculado ??
            values.valorMultaCalculado,
          valorDescontar:
            valuesPagoPrincipal.valorDescontar ?? values.valorDescontar,
          multaOmitida:
            valuesPagoPrincipal.multaOmitida ?? values.multaOmitida,
          descuentoModificado:
            valuesPagoPrincipal.descuentoModificado ??
            values.descuentoModificado,
          valorDescontarPersistido:
            valuesPagoPrincipal.valorDescontarPersistido,
          vistaPreviaDescuento:
            valuesPagoPrincipal.vistaPreviaDescuento,
        },
      ];
    }),
  );
  const totalValorDescontar = Number(
    vendedor.resumenMensual?.totalValorDescontar ??
      vistaPersonal.resumenMensual?.totalValorDescontar ??
      0,
  );

  return {
    ...vendedor,
    ...vistaPersonal,
    semanas,
    total: {
      ...(vistaPersonal.total || {}),
      noCumpleMetas:
        vendedor.total?.noCumpleMetas ??
        vistaPersonal.total?.noCumpleMetas ??
        0,
      valorDescontar: totalValorDescontar,
    },
    resumenMensual: {
      ...(vistaPersonal.resumenMensual || {}),
      totalNoCumpleMetas:
        vendedor.resumenMensual?.totalNoCumpleMetas ??
        vistaPersonal.resumenMensual?.totalNoCumpleMetas ??
        0,
      totalValorDescontar,
      totalPagar: roundMoney(-totalValorDescontar),
    },
    esJefeComercial: false,
    esSupervisorComercial: false,
    vendedoresJunior: [],
    vistaVentasPersonales: true,
  };
};

const SECCIONES = [
  { id: "VENDEDORES", label: "Vendedores" },
  { id: "SANCIONES", label: "Sanción por no llegar a meta" },
  { id: "JEFES", label: "Jefes comerciales" },
  { id: "SUPERVISORES", label: "Supervisores" },
  { id: "LOGISTICA", label: "Logistica" },
];

const EXPORT_OPTIONS = [
  { value: "TODAS", label: "Las 5 secciones" },
  { value: "VENDEDORES", label: "Vendedores" },
  { value: "SANCIONES", label: "Sanción por no llegar a meta" },
  { value: "JEFES", label: "Jefes comerciales" },
  { value: "SUPERVISORES", label: "Supervisores" },
  { value: "LOGISTICA", label: "Logistica" },
];

const getRowsForSection = (vendedores, seccion) =>
  vendedores
    .filter((vendedor) => perteneceASeccion(vendedor, seccion))
    .map((vendedor) => getVendedorParaSeccion(vendedor, seccion));

const EXCEL_BORDER = {
  top: { style: "thin", color: { argb: "FF000000" } },
  left: { style: "thin", color: { argb: "FF000000" } },
  bottom: { style: "thin", color: { argb: "FF000000" } },
  right: { style: "thin", color: { argb: "FF000000" } },
};

const EXCEL_WEEK_FILLS = [
  "FFFFE4C4",
  "FFFFFFFF",
  "FFFFF2CC",
  "FFFFFFFF",
  "FFBFD2F3",
  "FFEAD1DC",
];

const EXCEL_MONEY_FORMAT = '#,##0.00';
const EXCEL_INTEGER_FORMAT = '0';

const getExcelWeekLabel = (week) =>
  String(week?.label || "")
    .replace(/^S\d+\s+/i, "")
    .trim()
    .toUpperCase();

const getSafeSheetName = (name) =>
  String(name || "Reporte")
    .replace(/[\\/?*[\]:]/g, " ")
    .slice(0, 31);

const downloadExcelBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const styleExcelCell = (cell, fill = "FFFFFFFF", font = {}) => {
  cell.border = EXCEL_BORDER;
  cell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: fill },
  };
  cell.font = {
    name: "Arial",
    size: 10,
    color: { argb: "FF000000" },
    ...font,
  };
  cell.alignment = {
    horizontal: "center",
    vertical: "middle",
    wrapText: true,
  };
};

const getSalesWeekColumns = () => {
  const columns = [
    {
      label: "Dispositivos vendidos",
      width: 13,
      numFmt: EXCEL_INTEGER_FORMAT,
      getValue: (values) => Number(values.venden || 0),
    },
    {
      label: "Monto vendido",
      width: 15,
      numFmt: EXCEL_MONEY_FORMAT,
      getValue: (values) => Number(values.valorVendido || 0),
    },
    {
      label: "comision",
      width: 14,
      numFmt: EXCEL_MONEY_FORMAT,
      getValue: (values) => Number(values.totalComisiones || 0),
    },
  ];
  if (SHOW_GOAL_COMPLIANCE_SECTION) {
    columns.push({
      label: "no cumple metas",
      width: 16,
      numFmt: EXCEL_MONEY_FORMAT,
      getValue: (values) => Number(values.valorDescontar || 0),
    });
  }
  return columns;
};

const getSalesMonthlyColumns = () => {
  const columns = [
    {
      label: "Ventas de Dispositivo Mensual",
      width: 18,
      numFmt: EXCEL_INTEGER_FORMAT,
      getValue: (row) => Number(getMonthlyValues(row).ventasTvCelulaMensual || 0),
    },
    {
      label: "VALOR COMISION SEMANAL VENDEDORES",
      width: 18,
      numFmt: EXCEL_MONEY_FORMAT,
      getValue: (row) => Number(getMonthlyValues(row).valorComisionSemanal || 0),
    },
    {
      label: "Valor comision mensual",
      width: 17,
      numFmt: EXCEL_MONEY_FORMAT,
      getValue: (row) => Number(getMonthlyValues(row).valorComisionMensual || 0),
    },
    {
      label: "TOTAL COMISIONES SEMANALES Y MENSUALES",
      width: 20,
      numFmt: EXCEL_MONEY_FORMAT,
      getValue: (row) =>
        Number(getMonthlyValues(row).totalComisionesSemanaMensual || 0),
    },
  ];
  if (SHOW_GOAL_COMPLIANCE_SECTION) {
    columns.push({
      label: "Total no cumple metas",
      width: 18,
      numFmt: EXCEL_MONEY_FORMAT,
      getValue: (row) => Number(getMonthlyValues(row).totalValorDescontar || 0),
    });
  }
  return columns;
};

const getLogisticsTables = (rows) => {
  const managers = rows.filter((row) => row.esEncargadoLogistica);
  const drivers = rows.filter((row) => !row.esEncargadoLogistica);
  return (managers.length ? managers : [null]).map((manager) => ({
    manager,
    people: manager ? [manager, ...drivers] : drivers,
    totalDeliveries: Number(manager?.resumenMensual?.totalEntregas || 0) +
      drivers.reduce((sum, driver) => sum + Number(driver.resumenMensual?.totalEntregas || 0), 0),
  }));
};

const getSalesCollaboratorStyle = (row, defaultFill) => {
  const cargos = getCargosComerciales(row);
  if (cargos.some((cargo) => cargo.includes("PISO"))) {
    return {
      fill: "FFFF0000",
      font: { bold: true, color: { argb: "FFFFFFFF" } },
    };
  }
  if (cargos.some((cargo) => cargo.includes("CALL CENTER"))) {
    return {
      fill: "FFFFFF00",
      font: { bold: true, color: { argb: "FF000000" } },
    };
  }
  return {
    fill: defaultFill,
    font: { bold: true },
  };
};

const createGroupedExcelSheet = ({
  workbook,
  sheetName,
  rows,
  weeks,
  weekColumns,
  monthlyColumns,
  getRowWeekValues,
  getCollaboratorValue,
  getCollaboratorStyle = (_row, defaultFill) => ({
    fill: defaultFill,
    font: { bold: true },
  }),
}) => {
  const worksheet = workbook.addWorksheet(getSafeSheetName(sheetName));
  const weeklyColumnCount = weekColumns.length;
  const totalColumns = 1 + weeks.length * weeklyColumnCount + monthlyColumns.length;

  worksheet.views = [{ state: "frozen", xSplit: 1, ySplit: 2 }];
  worksheet.getColumn(1).width = 38;

  worksheet.mergeCells(1, 1, 2, 1);
  const collaboratorHeader = worksheet.getCell(1, 1);
  collaboratorHeader.value = "Colaborador";
  styleExcelCell(collaboratorHeader, "FFFFFFFF", { bold: true });

  let currentColumn = 2;
  weeks.forEach((week, weekIndex) => {
    const startColumn = currentColumn;
    const endColumn = currentColumn + weeklyColumnCount - 1;
    const fill = EXCEL_WEEK_FILLS[weekIndex % EXCEL_WEEK_FILLS.length];

    worksheet.mergeCells(1, startColumn, 1, endColumn);
    const weekHeader = worksheet.getCell(1, startColumn);
    weekHeader.value = getExcelWeekLabel(week);
    styleExcelCell(weekHeader, fill, { bold: true });

    weekColumns.forEach((column) => {
      const headerCell = worksheet.getCell(2, currentColumn);
      headerCell.value = column.label;
      styleExcelCell(headerCell, fill, { bold: true });
      worksheet.getColumn(currentColumn).width = column.width;
      currentColumn += 1;
    });

    for (let column = startColumn; column <= endColumn; column += 1) {
      styleExcelCell(worksheet.getCell(1, column), fill, { bold: true });
    }
  });

  monthlyColumns.forEach((column, index) => {
    worksheet.mergeCells(1, currentColumn, 2, currentColumn);
    const fill = index % 2 === 0 ? "FFFCE4D6" : "FFE6B8B7";
    const headerCell = worksheet.getCell(1, currentColumn);
    headerCell.value = column.label;
    styleExcelCell(headerCell, fill, { bold: true });
    worksheet.getColumn(currentColumn).width = column.width;
    currentColumn += 1;
  });

  if (!rows.length) {
    worksheet.mergeCells(3, 1, 3, totalColumns);
    const emptyCell = worksheet.getCell(3, 1);
    emptyCell.value = "Sin registros";
    styleExcelCell(emptyCell, "FFFFFFFF", { italic: true });
    return worksheet;
  }

  rows.forEach((row, rowIndex) => {
    const worksheetRow = worksheet.addRow([]);
    const fill = rowIndex % 2 === 0 ? "FFFFFFFF" : "FFFFECD4";
    let columnIndex = 1;

    const collaboratorCell = worksheetRow.getCell(columnIndex);
    collaboratorCell.value = getCollaboratorValue(row);
    const collaboratorStyle = getCollaboratorStyle(row, fill);
    styleExcelCell(
      collaboratorCell,
      collaboratorStyle.fill,
      collaboratorStyle.font,
    );
    collaboratorCell.alignment = {
      horizontal: "left",
      vertical: "middle",
      wrapText: true,
    };
    columnIndex += 1;

    weeks.forEach((week) => {
      const values = getRowWeekValues(row, week);
      weekColumns.forEach((column) => {
        const cell = worksheetRow.getCell(columnIndex);
        cell.value = values.semanaFutura ? "-" : column.getValue(values, row);
        styleExcelCell(cell, fill, column.label.includes("comision") ? { bold: true } : {});
        if (typeof cell.value === "number") cell.numFmt = column.numFmt;
        columnIndex += 1;
      });
    });

    monthlyColumns.forEach((column) => {
      const cell = worksheetRow.getCell(columnIndex);
      cell.value = column.getValue(row);
      styleExcelCell(cell, fill, column.label.toUpperCase().includes("TOTAL") ? { bold: true } : {});
      cell.numFmt = column.numFmt;
      columnIndex += 1;
    });
    worksheetRow.height = 28;
  });

  const totalRow = worksheet.addRow([]);
  let columnIndex = 1;
  const totalCell = totalRow.getCell(columnIndex);
  totalCell.value = "TOTAL";
  styleExcelCell(totalCell, "FFFF00FF", { bold: true });
  columnIndex += 1;

  weeks.forEach((week) => {
    weekColumns.forEach((column) => {
      const cell = totalRow.getCell(columnIndex);
      cell.value = rows.reduce((sum, row) => {
        const values = getRowWeekValues(row, week);
        return values.semanaFutura ? sum : sum + Number(column.getValue(values, row) || 0);
      }, 0);
      styleExcelCell(cell, "FFFF00FF", { bold: true });
      cell.numFmt = column.numFmt;
      columnIndex += 1;
    });
  });

  monthlyColumns.forEach((column) => {
    const cell = totalRow.getCell(columnIndex);
    cell.value = column.aggregate === false ? "" : rows.reduce((sum, row) => sum + Number(column.getValue(row) || 0), 0);
    styleExcelCell(cell, "FFFF00FF", { bold: true });
    cell.numFmt = column.numFmt;
    columnIndex += 1;
  });

  worksheet.autoFilter = {
    from: { row: 2, column: 1 },
    to: { row: 2, column: totalColumns },
  };
  return worksheet;
};

const createSalesExcelSheet = ({ workbook, rows, weeks, sectionLabel }) =>
  createGroupedExcelSheet({
    workbook,
    sheetName: sectionLabel,
    rows,
    weeks,
    weekColumns: getSalesWeekColumns(),
    monthlyColumns: getSalesMonthlyColumns(),
    getRowWeekValues: getWeekValues,
    getCollaboratorValue: (row) =>
      [row.nombre, row.cargoComision || row.cargo].filter(Boolean).join("\n"),
    getCollaboratorStyle: getSalesCollaboratorStyle,
  });

const createLogisticsExcelSheet = ({ workbook, rows }) => {
  const worksheet = workbook.addWorksheet("Logistica");
  worksheet.getColumn(1).width = 36;
  if (!rows.length) {
    worksheet.addRow(["No hay personal activo de logística para el período seleccionado."]);
    return worksheet;
  }
  getLogisticsTables(rows).forEach(({ manager, people, totalDeliveries }) => {
    const addRow = (values, fills = [], bold = false) => {
      const row = worksheet.addRow(values);
      row.height = 30;
      values.forEach((_value, index) => {
        const cell = row.getCell(index + 1);
        const fill = fills[index] || "FFFFFFFF";
        styleExcelCell(cell, fill, {
          bold,
          color: { argb: fill === "FF0369A1" ? "FFFFFFFF" : "FF0F172A" },
        });
        if (index === 0) cell.alignment.horizontal = "left";
        if (typeof cell.value === "number") {
          cell.numFmt = '#,##0.##';
          cell.alignment.horizontal = "right";
        }
        if (index > 0) worksheet.getColumn(index + 1).width = 22;
      });
      return row;
    };
    const headerRow = addRow(
      ["ENCARGADO LOGÍSTICA", ...people.map((person) => person.nombre.toUpperCase())],
      Array(people.length + 1).fill("FFBAE6FD"), true,
    );
    headerRow.height = 44;
    addRow([
      manager?.nombre.toUpperCase() || "SIN ENCARGADO ASIGNADO",
      ...people.map((person) => Number(person.resumenMensual?.totalEntregas || 0)),
    ], [], true);
    if (manager) {
      addRow([
        "ENTREGAS PROPIAS DEL ENCARGADO",
        Number(manager.resumenMensual?.totalEntregas || 0),
        ...people.slice(1).map(() => null),
      ], Array(people.length + 1).fill("FFD1FAE5"), true);
      const summaryHeader = addRow(["RESUMEN DEL ENCARGADO", "Total entregas", "Bono del encargado ($): total ÷ 2", "A recibir encargado ($)"], Array(4).fill("FFE0F2FE"), true);
      summaryHeader.height = 44;
      const summary = addRow([
        "TOTALES", totalDeliveries,
        Number(manager.resumenMensual?.totalBonoJuniors || 0),
        Number(manager.resumenMensual?.totalPagar || 0),
      ], Array(4).fill("FF0369A1"), true);
      summary.getCell(3).numFmt = EXCEL_MONEY_FORMAT;
      summary.getCell(4).numFmt = EXCEL_MONEY_FORMAT;
      ["Total de entregas", "Bono del encargado: total de entregas dividido para 2", "Total a pagar al encargado"]
        .forEach((label, index) => { summary.getCell(index + 2).note = label; });
    }
    worksheet.addRow([]);
  });
  return worksheet;
};

const createPenaltiesExcelSheet = ({ workbook, rows, weeks, observaciones = {} }) => {
  const worksheet = createGroupedExcelSheet({
    workbook,
    sheetName: "Sanción por no llegar a meta",
    rows,
    weeks,
    weekColumns: [
      {
        label: "Unidades vendidas",
        width: 16,
        numFmt: EXCEL_INTEGER_FORMAT,
        getValue: (values) => Number(values.venden || 0),
      },
      {
        label: "Unidades faltantes para meta",
        width: 16,
        numFmt: EXCEL_INTEGER_FORMAT,
        getValue: (values) => Number(values.noCumpleMetas || 0),
      },
      {
        label: "Valor a descontar",
        width: 18,
        numFmt: EXCEL_MONEY_FORMAT,
        getValue: (values) => Number(values.valorDescontar || 0),
      },
    ],
    monthlyColumns: [
      {
        label: "TOTAL SANCIONES DEL MES",
        width: 20,
        numFmt: EXCEL_MONEY_FORMAT,
        getValue: (row) => getPenaltyTotal(row, weeks),
      },
      { label: "Observación", width: 50, numFmt: "@", aggregate: false, getValue: (row) => observaciones[row.usuarioId] || "" },
    ],
    getRowWeekValues: getPenaltyWeekValues,
    getCollaboratorValue: (row) =>
      [row.nombre, row.cargoComision || row.cargo].filter(Boolean).join("\n"),
    getCollaboratorStyle: getSalesCollaboratorStyle,
  });

  rows.forEach((row, index) => {
    const excelRow = worksheet.getRow(index + 3);
    excelRow.getCell(weeks.length * 3 + 3).alignment = { wrapText: true, vertical: "top", horizontal: "left" };
    const lines = String(observaciones[row.usuarioId] || "").split("\n").reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / 48)), 0);
    excelRow.height = Math.min(409, Math.max(28, lines * 15));
  });
  return worksheet;
};

export default function PagosComisiones() {
  const [filters, setFilters] = useState(initialFilters);
  const [logisticaFilters, setLogisticaFilters] = useState(initialLogisticaFilters);
  const [report, setReport] = useState(null);
  const reportRevision = useRef(0);
  const [loading, setLoading] = useState(false);
  const [vendedorFiltro, setVendedorFiltro] = useState("");
  const [vendedorBusqueda, setVendedorBusqueda] = useState("");
  const [colaboradoresOpen, setColaboradoresOpen] = useState(false);
  const [cargoFiltro, setCargoFiltro] = useState("");
  const [juniorId, setJuniorId] = useState("");
  const [jefeComercialId, setJefeComercialId] = useState("");
  const [guardandoJefe, setGuardandoJefe] = useState(false);
  const [guardandoEquipoSemanal, setGuardandoEquipoSemanal] = useState("");
  const [guardandoPromedioJefe, setGuardandoPromedioJefe] = useState("");
  const [guardandoPromedioSupervisor, setGuardandoPromedioSupervisor] = useState("");
  const [juniorSupervisorId, setJuniorSupervisorId] = useState("");
  const [supervisorComercialId, setSupervisorComercialId] = useState("");
  const [guardandoSupervisor, setGuardandoSupervisor] = useState(false);
  const [descuentosEditados, setDescuentosEditados] = useState({});
  const [observacionesEditadas, setObservacionesEditadas] = useState({});
  const [guardandoDescuentos, setGuardandoDescuentos] = useState(false);
  const [juniorSupervisorBusqueda, setJuniorSupervisorBusqueda] = useState("");
  const [juniorSupervisorOpen, setJuniorSupervisorOpen] = useState(false);
  const [seccionActiva, setSeccionActiva] = useState("VENDEDORES");
  const [configOpen, setConfigOpen] = useState(false);
  const [configLoading, setConfigLoading] = useState(false);
  const [configSaving, setConfigSaving] = useState(false);
  const [configMeses, setConfigMeses] = useState([]);
  const [configOriginalMeses, setConfigOriginalMeses] = useState([]);
  const [configResumen, setConfigResumen] = useState(null);
  const [exportScope, setExportScope] = useState("TODAS");
  const [exportandoExcel, setExportandoExcel] = useState(false);
  const [pagandoPeriodo, setPagandoPeriodo] = useState(false);

  const years = useMemo(() => {
    const currentYear = currentDate.getFullYear();
    return Array.from({ length: 7 }, (_, index) => currentYear - 3 + index);
  }, []);

  const weeks = useMemo(() => report?.weeks || [], [report]);
  const logisticaWeeks = useMemo(
    () => report?.logisticaWeeks || weeks,
    [report, weeks],
  );
  const logisticaPeriodo = report?.logisticaPeriodo || logisticaFilters;
  const configuracionMes = report?.configuracionMes || null;
  const estadoPago = report?.estadoPago || null;
  const periodoPagado = Boolean(estadoPago?.pagado);
  const cantidadCambiosPendientes = Object.keys(descuentosEditados).length + Object.keys(observacionesEditadas).length;
  const mostrarGestionDescuentos = seccionActiva !== "LOGISTICA" && (
    seccionActiva === "SANCIONES" ||
    SHOW_GOAL_COMPLIANCE_SECTION ||
    cantidadCambiosPendientes > 0
  );
  const selectedMonthLabel =
    MONTHS.find((month) => Number(month.value) === Number(filters.month))?.label ||
    "";
  const vendedoresBase = useMemo(
    () => filtrarPorPermanencia(report?.vendedores || []),
    [report],
  );
  const logistica = useMemo(
    () => filtrarPorPermanencia(report?.logistica || []),
    [report],
  );
  const vendedores = useMemo(() => {
    if (!Object.keys(descuentosEditados).length) return vendedoresBase;

    return vendedoresBase.map((vendedor) => {
      let semanasConVistaPrevia = null;
      let diferenciaDescuentos = 0;

      weeks.forEach((week) => {
        const key = `${vendedor.usuarioId}-${week.startDate}`;
        const ajuste = descuentosEditados[key];
        if (!ajuste) return;

        const values = getWeekValues(vendedor, week);
        const valorVistaPrevia = ajuste.restaurarValorCalculado
          ? Number(values.valorMultaCalculado || 0)
          : parseValorDescuentoInput(ajuste.valorDescontar);
        if (valorVistaPrevia === null) return;

        const valorPersistido = Number(values.valorDescontar || 0);
        if (!semanasConVistaPrevia) semanasConVistaPrevia = { ...vendedor.semanas };
        semanasConVistaPrevia[week.startDate] = {
          ...values,
          valorDescontar: roundMoney(valorVistaPrevia),
          valorDescontarPersistido: valorPersistido,
          vistaPreviaDescuento: true,
        };
        diferenciaDescuentos += valorVistaPrevia - valorPersistido;
      });

      if (!semanasConVistaPrevia) return vendedor;

      const mensual = getMonthlyValues(vendedor);
      const totalValorDescontar = roundMoney(
        Number(mensual.totalValorDescontar || 0) + diferenciaDescuentos,
      );
      return {
        ...vendedor,
        semanas: semanasConVistaPrevia,
        total: vendedor.total
          ? {
              ...vendedor.total,
              valorDescontar: roundMoney(
                Number(vendedor.total.valorDescontar || 0) + diferenciaDescuentos,
              ),
            }
          : vendedor.total,
        resumenMensual: {
          ...mensual,
          totalValorDescontar,
          totalPagar: roundMoney(
            Number(mensual.totalComisionesSemanaMensual || 0) - totalValorDescontar,
          ),
        },
      };
    });
  }, [descuentosEditados, vendedoresBase, weeks]);
  const configMesesPreview = useMemo(
    () => buildCalendarPreview(filters.year, configMeses),
    [configMeses, filters.year],
  );
  const semanasConfiguradas = useMemo(
    () =>
      configMeses.reduce(
        (total, item) => total + Number(item.cantidadSemanas || 0),
        0,
      ),
    [configMeses],
  );
  const semanasRequeridas = configResumen?.semanasRequeridas || 0;
  const configuracionValida =
    configMeses.length === 12 && semanasConfiguradas === semanasRequeridas;
  const configPastChanged = useMemo(
    () =>
      configMeses.some((item) => {
        const original = configOriginalMeses.find(
          (row) => Number(row.mes) === Number(item.mes),
        );
        return (
          original &&
          Number(original.cantidadSemanas) !== Number(item.cantidadSemanas) &&
          isPastCommercialMonth(filters.year, item.mes)
        );
      }),
    [configMeses, configOriginalMeses, filters.year],
  );
  const vendedoresSeccion = useMemo(
    () =>
      vendedores
        .filter((vendedor) =>
          perteneceASeccion(vendedor, seccionActiva),
        )
        .map((vendedor) =>
          getVendedorParaSeccion(vendedor, seccionActiva),
        ),
    [seccionActiva, vendedores],
  );

  const vendedoresFiltrados = useMemo(() => vendedoresSeccion.filter((vendedor) => {
    if (vendedorFiltro && String(vendedor.usuarioId) !== vendedorFiltro) return false;
    return cumpleFiltroCargo(vendedor, cargoFiltro);
  }), [vendedoresSeccion, vendedorFiltro, cargoFiltro]);

  const vendedoresPorCargo = useMemo(
    () => vendedoresSeccion.filter((vendedor) => cumpleFiltroCargo(vendedor, cargoFiltro)),
    [vendedoresSeccion, cargoFiltro],
  );

  const colaboradoresCoincidentes = useMemo(() => {
    const busqueda = normalizeSearchText(vendedorBusqueda);
    return vendedoresPorCargo.filter((vendedor) => {
      if (!busqueda) return true;
      const texto = normalizeSearchText(
        [
          vendedor.nombre,
          vendedor.cargoComision,
          vendedor.cargo,
          vendedor.rol,
          getCargosPagoLabel(vendedor),
        ]
          .filter(Boolean)
          .join(" "),
      );
      return texto.includes(busqueda);
    });
  }, [vendedorBusqueda, vendedoresPorCargo]);

  const jefesComerciales = useMemo(
    () => vendedores.filter(
      (vendedor) =>
        vendedor.activo !== false &&
        String(vendedor.cargo || "").toUpperCase().includes("JEFE COMERCIAL"),
    ),
    [vendedores],
  );

  const vendedoresElegiblesEquipo = useMemo(() => {
    const disponibles = report?.vendedoresDisponiblesEquipo;
    const candidatos = Array.isArray(disponibles)
      ? filtrarPorPermanencia(disponibles)
      : vendedores.filter(
          (vendedor) =>
            String(vendedor.rol || "").toUpperCase().includes("VENDEDOR") ||
            getCargosComerciales(vendedor).some(
              (cargo) =>
                cargo.includes("VENDEDOR") &&
                !cargo.includes("JEFE") &&
                !cargo.includes("SUPERVISOR"),
            ),
        );
    return [...candidatos].sort((a, b) =>
      String(a.nombre || "").localeCompare(String(b.nombre || ""), "es"),
    );
  }, [report, vendedores]);

  const juniorsSupervisorCoincidentes = useMemo(() => {
    const busqueda = normalizeSearchText(juniorSupervisorBusqueda);
    return vendedoresElegiblesEquipo.filter((vendedor) => {
      if (!busqueda) return true;
      const texto = normalizeSearchText(
        [
          vendedor.nombre,
          vendedor.cargoComision,
          vendedor.cargo,
          vendedor.rol,
          getCargosPagoLabel(vendedor),
        ]
          .filter(Boolean)
          .join(" "),
      );
      return texto.includes(busqueda);
    });
  }, [juniorSupervisorBusqueda, vendedoresElegiblesEquipo]);

  const supervisoresComerciales = useMemo(
    () => vendedores.filter(
      (vendedor) =>
        vendedor.activo !== false &&
        getSeccionCargo(vendedor) === "SUPERVISORES",
    ),
    [vendedores],
  );

  const totalVisible = useMemo(() => {
    const resumen = {
      semanas: Object.fromEntries(weeks.map((week) => [week.startDate, {
        ...emptyWeekValues,
        semanaFutura: vendedoresFiltrados[0]?.semanas?.[week.startDate]?.semanaFutura || false,
      }])),
      general: { ...emptyWeekValues },
      resumenMensual: { ...emptyMonthlyValues },
    };
    vendedoresFiltrados.forEach((vendedor) => {
      weeks.forEach((week) => {
        const values = getWeekValues(vendedor, week);
        Object.keys(emptyWeekValues).forEach((key) => {
          resumen.semanas[week.startDate][key] += Number(values[key] || 0);
          resumen.general[key] += Number(values[key] || 0);
        });
      });
      const mensual = getMonthlyValues(vendedor);
      Object.keys(emptyMonthlyValues).forEach((key) => {
        resumen.resumenMensual[key] += Number(mensual[key] || 0);
      });
    });
    return resumen;
  }, [vendedoresFiltrados, weeks]);

  const totalLogistica = useMemo(
    () =>
      logistica.reduce(
        (total, persona) => ({
          entregas:
            total.entregas +
            Number(persona.resumenMensual?.totalEntregas || 0),
          totalPagar:
            total.totalPagar +
            Number(persona.resumenMensual?.totalPagar || 0),
        }),
        { entregas: 0, totalPagar: 0 },
      ),
    [logistica],
  );

  const cambiarSeccion = (seccion) => {
    setSeccionActiva(seccion);
    setCargoFiltro("");
    setVendedorFiltro("");
    setVendedorBusqueda("");
    setColaboradoresOpen(false);
    setJuniorSupervisorBusqueda("");
    setJuniorSupervisorOpen(false);
  };

  const actualizarPeriodoComercial = (nextFilters) => {
    setFilters(nextFilters);
    setLogisticaFilters(getCalendarMonthRange(nextFilters));
  };

  const cambiarMes = (month) => {
    actualizarPeriodoComercial({ ...filters, month: Number(month) });
  };

  const cambiarAnio = (year) => {
    actualizarPeriodoComercial({ ...filters, year: Number(year) });
  };

  const fetchReport = async (reportFilters = filters) => {
    reportRevision.current += 1;
    setLoading(true);
    try {
      const params = {
        ...reportFilters,
        logisticaFechaInicio: logisticaFilters.fechaInicio,
        logisticaFechaFin: logisticaFilters.fechaFin,
      };
      const { data } = await api.get(ENDPOINT, { params });
      setReport(data);
      setObservacionesEditadas({});
      setDescuentosEditados({});
    } catch (error) {
      console.error("Error cargando pagos de comisiones", error);
      Swal.fire(
        "Error",
        error.response?.data?.message || "No se pudo cargar el reporte de pagos",
        "error",
      );
    } finally {
      setLoading(false);
    }
  };

  const cargarConfiguracionMeses = async () => {
    setConfigLoading(true);
    try {
      const { data } = await api.get(`${ENDPOINT}/configuracion-meses`, {
        params: { year: filters.year },
      });
      const meses = (data.meses || []).map((item) => ({
        mes: Number(item.mes),
        cantidadSemanas: Number(item.cantidadSemanas),
        observacion: item.observacion || "",
        estado: item.estado,
        configuradaManualmente: Boolean(item.configuradaManualmente),
        fechaInicio: item.fechaInicio,
        fechaFin: item.fechaFin,
      }));
      setConfigMeses(meses);
      setConfigOriginalMeses(meses);
      setConfigResumen(data.resumen || null);
    } catch (error) {
      Swal.fire(
        "Error",
        error.response?.data?.message ||
          "No se pudo cargar la configuracion de meses",
        "error",
      );
    } finally {
      setConfigLoading(false);
    }
  };

  const abrirConfiguracionMes = async () => {
    setConfigOpen(true);
    await cargarConfiguracionMeses();
  };

  const cambiarCantidadSemanas = (mes, cantidadSemanas) => {
    setConfigMeses((current) =>
      current.map((item) =>
        Number(item.mes) === Number(mes)
          ? { ...item, cantidadSemanas: Number(cantidadSemanas) }
          : item,
      ),
    );
  };

  const guardarConfiguracionAnual = async () => {
    if (!configuracionValida) return;

    if (configPastChanged) {
      const confirmacion = await Swal.fire({
        title: "Recalcular periodo",
        text: "Cambiar esta configuracion recalculara las semanas y valores del reporte de comisiones de este periodo.",
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Guardar cambios",
        cancelButtonText: "Cancelar",
        confirmButtonColor: "#059669",
      });
      if (!confirmacion.isConfirmed) return;
    }

    setConfigSaving(true);
    try {
      const { data } = await api.put(
        `${ENDPOINT}/configuracion-anual/${filters.year}`,
        {
          meses: configMeses.map(({ mes, cantidadSemanas, observacion }) => ({
            mes,
            cantidadSemanas,
            observacion,
          })),
        },
      );
      const meses = (data.meses || []).map((item) => ({
        mes: Number(item.mes),
        cantidadSemanas: Number(item.cantidadSemanas),
        observacion: item.observacion || "",
        estado: item.estado,
        configuradaManualmente: Boolean(item.configuradaManualmente),
        fechaInicio: item.fechaInicio,
        fechaFin: item.fechaFin,
      }));
      setConfigMeses(meses);
      setConfigOriginalMeses(meses);
      setConfigResumen(data.resumen || null);
      await fetchReport();
      Swal.fire("Listo", "Configuracion anual guardada", "success");
      setConfigOpen(false);
    } catch (error) {
      Swal.fire(
        "Error",
        error.response?.data?.message ||
          "No se pudo guardar la configuracion anual",
        "error",
      );
    } finally {
      setConfigSaving(false);
    }
  };

  const exportarExcel = async () => {
    if (!report || !weeks.length) {
      Swal.fire("Sin datos", "Genere el reporte antes de exportar", "info");
      return;
    }

    setExportandoExcel(true);
    try {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = "RVE - Pagos Comisiones";
      workbook.company = "Creditek Ecuador";
      workbook.subject = "Pagos de comisiones";
      workbook.category = "Contabilidad";
      workbook.created = new Date();
      workbook.modified = new Date();

      const scopes =
        exportScope === "TODAS"
          ? SECCIONES.map((seccion) => seccion.id)
          : [exportScope];

      scopes.forEach((scope) => {
        const section = SECCIONES.find((item) => item.id === scope);
        if (scope === "SANCIONES") {
          createPenaltiesExcelSheet({
            workbook,
            rows: getRowsForSection(vendedores, scope),
            weeks,
            observaciones: report.observacionesVendedores,
          });
          return;
        }
        if (scope === "LOGISTICA") {
          createLogisticsExcelSheet({
            workbook,
            rows: logistica,
          });
          return;
        }

        createSalesExcelSheet({
          workbook,
          rows: getRowsForSection(vendedores, scope),
          weeks,
          sectionLabel: section?.label || scope,
        });
      });

      const estado = periodoPagado ? "PAGADO" : "ABIERTO";
      const mes = selectedMonthLabel || filters.month;
      const buffer = await workbook.xlsx.writeBuffer();
      downloadExcelBlob(
        new Blob([buffer], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }),
        `Pagos_Comisiones_${mes}_${filters.year}_${estado}.xlsx`,
      );
    } catch (error) {
      console.error("Error exportando pagos comisiones", error);
      Swal.fire("Error", "No se pudo generar el archivo Excel", "error");
    } finally {
      setExportandoExcel(false);
    }
  };

  const marcarPeriodoPagado = async () => {
    if (!report || periodoPagado) return;

    const confirmacion = await Swal.fire({
      title: "Marcar como pagado",
      text: "Al marcar este periodo como pagado, el reporte quedara guardado y ya no se recalculara.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Marcar pagado",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#059669",
    });
    if (!confirmacion.isConfirmed) return;

    setPagandoPeriodo(true);
    try {
      const { data } = await api.put(
        `${ENDPOINT}/periodos/${filters.year}/${filters.month}/pagado`,
      );
      setReport(data);
      Swal.fire("Listo", "Periodo marcado como pagado", "success");
    } catch (error) {
      Swal.fire(
        "Error",
        error.response?.data?.message || "No se pudo marcar el periodo pagado",
        "error",
      );
    } finally {
      setPagandoPeriodo(false);
    }
  };

  const seleccionarJunior = (value) => {
    setJuniorId(value);
    const junior = vendedores.find((item) => String(item.usuarioId) === value);
    setJefeComercialId(junior?.jefeComercialId ? String(junior.jefeComercialId) : "");
  };

  const guardarJefeComercial = async () => {
    if (!juniorId) {
      return Swal.fire("Atencion", "Seleccione un vendedor junior", "warning");
    }

    setGuardandoJefe(true);
    try {
      await api.put(`${ENDPOINT}/vendedores/${juniorId}/jefe-comercial`, {
        jefeComercialId: jefeComercialId || null,
      });
      await fetchReport();
      Swal.fire(
        "Listo",
        jefeComercialId ? "Jefe comercial asignado correctamente" : "Asignacion eliminada",
        "success",
      );
    } catch (error) {
      Swal.fire(
        "Error",
        error.response?.data?.message || "No se pudo guardar la asignacion",
        "error",
      );
    } finally {
      setGuardandoJefe(false);
    }
  };

  const seleccionarJuniorSupervisor = (value) => {
    setJuniorSupervisorId(value);
    const junior = vendedores.find((item) => String(item.usuarioId) === value);
    setSupervisorComercialId(
      junior?.supervisorComercialId ? String(junior.supervisorComercialId) : "",
    );
  };

  const guardarSupervisorComercial = async () => {
    if (!juniorSupervisorId) {
      return Swal.fire("Atencion", "Seleccione un vendedor junior", "warning");
    }

    setGuardandoSupervisor(true);
    try {
      await api.put(
        `${ENDPOINT}/vendedores/${juniorSupervisorId}/supervisor-comercial`,
        { supervisorComercialId: supervisorComercialId || null },
      );
      await fetchReport();
      Swal.fire(
        "Listo",
        supervisorComercialId ? "Supervisor asignado correctamente" : "Asignacion eliminada",
        "success",
      );
    } catch (error) {
      Swal.fire(
        "Error",
        error.response?.data?.message || "No se pudo guardar la asignacion",
        "error",
      );
    } finally {
      setGuardandoSupervisor(false);
    }
  };

  const cambiarValorDescuento = ({ vendedor, week, values, value }) => {
    const key = `${vendedor.usuarioId}-${week.startDate}`;
    const valorIngresado = parseValorDescuentoInput(value);
    const valorActual = Number(
      values.valorDescontarPersistido ?? values.valorDescontar ?? 0,
    );

    setDescuentosEditados((actuales) => {
      const siguientes = { ...actuales };
      if (
        valorIngresado !== null &&
        Math.round(valorIngresado * 100) === Math.round(valorActual * 100)
      ) {
        delete siguientes[key];
      } else {
        siguientes[key] = {
          usuarioId: vendedor.usuarioId,
          vendedor: vendedor.nombre,
          semanaInicio: week.startDate,
          semana: week.label,
          valorDescontar: value,
          restaurarValorCalculado: false,
        };
      }
      return siguientes;
    });
  };

  const guardarEquipoSemanal = async ({ jefe, week, vendedorIds, cantidadVendedoresComision }) => {
    if (guardandoEquipoSemanal) return;
    const key = `${jefe.usuarioId}-${week.startDate}`;
    const tipoLider = jefe.esSupervisorComercial ? "supervisores" : "jefes";
    const revision = reportRevision.current;
    const cantidadAnterior = getWeekValues(jefe, week).cantidadVendedoresComision ?? null;
    const actualizarCantidad = (cantidad) => {
      if (revision !== reportRevision.current) return;
      setReport((actual) => actual ? {
        ...actual,
        vendedores: actual.vendedores.map((row) => Number(row.usuarioId) === Number(jefe.usuarioId) ? {
          ...row,
          semanas: {
            ...row.semanas,
            [week.startDate]: { ...row.semanas[week.startDate], cantidadVendedoresComision: cantidad },
          },
        } : row),
      } : actual);
    };
    setGuardandoEquipoSemanal(key);
    if (cantidadVendedoresComision !== undefined) actualizarCantidad(cantidadVendedoresComision);
    let guardado = false;
    try {
      await api.put(
        `${ENDPOINT}/${tipoLider}/${jefe.usuarioId}/equipos-semanales/${week.startDate}`,
        { vendedorIds, cantidadVendedoresComision },
      );
      guardado = true;
      const { data } = await api.get(ENDPOINT, {
        params: {
          year: report.year,
          month: report.month,
          logisticaFechaInicio: logisticaFilters.fechaInicio,
          logisticaFechaFin: logisticaFilters.fechaFin,
        },
      });
      if (revision !== reportRevision.current) return;
      setReport((actual) => actual ? {
        ...actual,
        total: data.total,
        vendedores: actual.vendedores.map((row) =>
          Number(row.usuarioId) === Number(jefe.usuarioId)
            ? data.vendedores.find((item) => Number(item.usuarioId) === Number(jefe.usuarioId)) || row
            : row,
        ),
      } : actual);
    } catch (error) {
      if (!guardado && cantidadVendedoresComision !== undefined) actualizarCantidad(cantidadAnterior);
      Swal.fire(
        "Error",
        guardado
          ? "La selección se guardó, pero no se pudieron actualizar los importes. Pulse Generar para recargarlos."
          : error.response?.data?.message || "No se pudo guardar el equipo semanal",
        "error",
      );
    } finally {
      setGuardandoEquipoSemanal("");
    }
  };

  const guardarPromedioSupervisorMensual = async ({ supervisor, vendedorIds }) => {
    const key = String(supervisor.usuarioId);
    setGuardandoPromedioSupervisor(key);
    try {
      await api.put(
        `${ENDPOINT}/supervisores/${supervisor.usuarioId}/promedio-mensual/${filters.year}/${filters.month}`,
        { vendedorIds },
      );
      await fetchReport();
      Swal.fire({
        icon: "success",
        title: "Promedio mensual guardado",
        showConfirmButton: false,
        timer: 1400,
      });
    } catch (error) {
      Swal.fire(
        "Error",
        error.response?.data?.message || "No se pudo guardar el promedio mensual",
        "error",
      );
    } finally {
      setGuardandoPromedioSupervisor("");
    }
  };

  const guardarPromedioJefeMensual = async ({ jefe, vendedorIds }) => {
    const key = String(jefe.usuarioId);
    setGuardandoPromedioJefe(key);
    try {
      await api.put(
        `${ENDPOINT}/jefes/${jefe.usuarioId}/promedio-mensual/${filters.year}/${filters.month}`,
        { vendedorIds },
      );
      await fetchReport();
      Swal.fire({
        icon: "success",
        title: "Promedio mensual guardado",
        showConfirmButton: false,
        timer: 1400,
      });
    } catch (error) {
      Swal.fire(
        "Error",
        error.response?.data?.message || "No se pudo guardar el promedio mensual",
        "error",
      );
    } finally {
      setGuardandoPromedioJefe("");
    }
  };

  const restaurarValorDescuento = ({ vendedor, week, values }) => {
    const key = `${vendedor.usuarioId}-${week.startDate}`;
    setDescuentosEditados((actuales) => {
      const siguientes = { ...actuales };
      if (!values.descuentoModificado) {
        delete siguientes[key];
        return siguientes;
      }
      siguientes[key] = {
        usuarioId: vendedor.usuarioId,
        vendedor: vendedor.nombre,
        semanaInicio: week.startDate,
        semana: week.label,
        valorDescontar: Number(values.valorMultaCalculado || 0).toFixed(2),
        restaurarValorCalculado: true,
      };
      return siguientes;
    });
  };

  const guardarValoresDescuento = async () => {
    if (!cantidadCambiosPendientes || !report || periodoPagado) return;

    const ajustes = [];
    for (const ajuste of Object.values(descuentosEditados)) {
      if (ajuste.restaurarValorCalculado) {
        ajustes.push({
          usuarioId: ajuste.usuarioId,
          semanaInicio: ajuste.semanaInicio,
          restaurarValorCalculado: true,
        });
        continue;
      }
      const valorDescontar = parseValorDescuentoInput(ajuste.valorDescontar);
      if (valorDescontar === null) {
        Swal.fire(
          "Valor invalido",
          `Revise el descuento de ${ajuste.vendedor} en ${ajuste.semana}.`,
          "warning",
        );
        return;
      }
      ajustes.push({
        usuarioId: ajuste.usuarioId,
        semanaInicio: ajuste.semanaInicio,
        valorDescontar,
      });
    }

    const confirmacion = await Swal.fire({
      title: "Guardar cambios de sanciones",
      text: `Se guardarán ${ajustes.length} descuento(s) y ${Object.keys(observacionesEditadas).length} observación(es).`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Guardar todo",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#059669",
    });
    if (!confirmacion.isConfirmed) return;

    setGuardandoDescuentos(true);
    try {
      const periodoReporte = { year: report.year, month: report.month };
      const { data } = await api.put(`${ENDPOINT}/multas`, {
        ...periodoReporte,
        ajustes,
        observacionesVendedores: Object.entries(observacionesEditadas).map(([usuarioId, observacion]) => ({ usuarioId: Number(usuarioId), observacion })),
      });
      setDescuentosEditados({});
      setFilters(periodoReporte);
      await fetchReport(periodoReporte);
      Swal.fire("Listo", data.message, "success");
    } catch (error) {
      Swal.fire(
        "Error",
        error.response?.data?.message || "No se pudieron guardar los descuentos",
        "error",
      );
    } finally {
      setGuardandoDescuentos(false);
    }
  };

  const generarReporte = async () => {
    if (!logisticaFilters.fechaInicio || !logisticaFilters.fechaFin) {
      Swal.fire("Atencion", "Seleccione el periodo de logistica", "warning");
      return;
    }
    if (logisticaFilters.fechaInicio > logisticaFilters.fechaFin) {
      Swal.fire(
        "Atencion",
        "La fecha inicial de logistica no puede ser mayor a la fecha final",
        "warning",
      );
      return;
    }
    if (cantidadCambiosPendientes) {
      const confirmacion = await Swal.fire({
        title: "Cambios sin guardar",
        text: "Al generar otro reporte se descartarán los descuentos y la observación pendientes.",
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Descartar y generar",
        cancelButtonText: "Cancelar",
      });
      if (!confirmacion.isConfirmed) return;
    }
    await fetchReport(filters);
  };

  useEffect(() => {
    fetchReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1800px] space-y-5">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-emerald-700">
                <BadgeDollarSign size={18} />
                Contabilidad
              </div>
              <h1 className="mt-2 text-2xl font-bold text-slate-900">
                Pagos comisiones
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Reporte semanal comercial de jueves a miercoles, agrupado por el jueves inicial.
              </p>
            </div>

            <div
              className={`grid gap-3 ${
                seccionActiva === "LOGISTICA"
                  ? "sm:grid-cols-[160px_160px_auto]"
                  : "sm:grid-cols-[150px_160px_auto_auto]"
              }`}
            >
              {seccionActiva === "LOGISTICA" ? (
                <>
                  <label className="text-xs font-semibold uppercase text-slate-500">
                    Inicio
                    <input
                      type="date"
                      value={logisticaFilters.fechaInicio}
                      onChange={(event) =>
                        setLogisticaFilters((current) => ({
                          ...current,
                          fechaInicio: event.target.value,
                        }))
                      }
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                    />
                  </label>
                  <label className="text-xs font-semibold uppercase text-slate-500">
                    Fin
                    <input
                      type="date"
                      value={logisticaFilters.fechaFin}
                      onChange={(event) =>
                        setLogisticaFilters((current) => ({
                          ...current,
                          fechaFin: event.target.value,
                        }))
                      }
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                    />
                  </label>
                </>
              ) : (
                <>
                  <select
                    value={filters.month}
                    onChange={(event) => cambiarMes(event.target.value)}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                  >
                    {MONTHS.map((month) => (
                      <option key={month.value} value={month.value}>
                        {month.label}
                      </option>
                    ))}
                  </select>

                  <select
                    value={filters.year}
                    onChange={(event) => cambiarAnio(event.target.value)}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                  >
                    {years.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </>
              )}

              <button
                type="button"
                onClick={generarReporte}
                disabled={loading}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
              >
                <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
                Generar
              </button>
              {seccionActiva !== "LOGISTICA" ? (
                <button
                  type="button"
                  onClick={abrirConfiguracionMes}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-600 px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50"
                >
                  <CalendarCog size={16} />
                  Configuracion de mes
                </button>
              ) : null}
            </div>
          </div>
          {seccionActiva === "LOGISTICA" ? (
            <div className="mt-4 flex flex-wrap gap-3 border-t border-slate-100 pt-4 text-sm text-slate-700">
              <span className="font-semibold text-slate-900">Logistica</span>
              <span>
                Periodo: {formatDate(logisticaPeriodo.fechaInicio)} al{" "}
                {formatDate(logisticaPeriodo.fechaFin)}
              </span>
            </div>
          ) : configuracionMes ? (
            <div className="mt-4 flex flex-wrap gap-3 border-t border-slate-100 pt-4 text-sm text-slate-700">
              <span className="font-semibold text-slate-900">
                {selectedMonthLabel} {filters.year}
              </span>
              <span>
                {configuracionMes.cantidadSemanasConfigurada} semanas comerciales
              </span>
              <span>
                Periodo: {formatDate(configuracionMes.fechaInicio)} al{" "}
                {formatDate(configuracionMes.fechaFin)}
              </span>
              <span>
                Bono mensual aplicado:{" "}
                {configuracionMes.cantidadSemanasConfigurada} semanas
              </span>
              {!configuracionMes.configuradaManualmente ? (
                <span className="text-amber-700">
                  Fallback historico sin configuracion anual manual
                </span>
              ) : null}
            </div>
          ) : null}
        </section>

        <nav className="flex flex-wrap gap-2 rounded-lg border border-slate-200 bg-white p-2 shadow-sm">
          {SECCIONES.map((seccion) => {
            const cantidad =
              seccion.id === "LOGISTICA"
                ? logistica.length
                : vendedores.filter((vendedor) =>
                    perteneceASeccion(vendedor, seccion.id),
                  ).length;
            return (
              <button
                type="button"
                key={seccion.id}
                onClick={() => cambiarSeccion(seccion.id)}
                className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                  seccionActiva === seccion.id
                    ? "bg-emerald-600 text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {seccion.label} ({cantidad})
              </button>
            );
          })}
        </nav>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric
            icon={<CalendarDays size={18} />}
            label={seccionActiva === "LOGISTICA" ? "Semanas" : "Semanas comerciales"}
            value={seccionActiva === "LOGISTICA" ? logisticaWeeks.length : weeks.length}
          />
          <Metric
            icon={
              seccionActiva === "LOGISTICA" ? (
                <Truck size={18} />
              ) : (
                <FileSpreadsheet size={18} />
              )
            }
            label={SECCIONES.find((seccion) => seccion.id === seccionActiva)?.label}
            value={
              seccionActiva === "LOGISTICA"
                ? logistica.length
                : vendedoresFiltrados.length
            }
          />
          <Metric
            label={
              seccionActiva === "LOGISTICA"
                ? "Entregas realizadas"
                : "Unidades vendidas"
            }
            value={
              seccionActiva === "LOGISTICA"
                ? totalLogistica.entregas
                : totalVisible.general.venden || 0
            }
          />
          <Metric
            label={
              seccionActiva === "SANCIONES"
                ? `Total sanciones del mes${cantidadCambiosPendientes ? " (vista previa)" : ""}`
                : cantidadCambiosPendientes
                ? "A recibir (vista previa)"
                : "A recibir"
            }
            value={
              seccionActiva === "LOGISTICA"
                ? formatCurrency(totalLogistica.totalPagar)
                : seccionActiva === "SANCIONES"
                  ? formatCurrency(vendedoresFiltrados.reduce(
                      (sum, row) => sum + getPenaltyTotal(row, weeks), 0,
                    ))
                  : formatMoney(totalVisible.resumenMensual.totalPagar)
            }
          />
        </div>

        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`rounded-lg p-2 ${
                  periodoPagado
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-amber-100 text-amber-700"
                }`}
              >
                {periodoPagado ? <Lock size={20} /> : <CheckCircle2 size={20} />}
              </div>
                <div>
                  <h2 className="font-semibold text-slate-900">
                  {seccionActiva === "LOGISTICA"
                    ? "Periodo de logistica"
                    : "Estado del periodo"}
                  </h2>
                  <p className="text-sm text-slate-600">
                  {seccionActiva === "LOGISTICA"
                    ? `Del ${formatDate(logisticaPeriodo.fechaInicio)} al ${formatDate(logisticaPeriodo.fechaFin)}`
                    : periodoPagado
                      ? `Pagado${estadoPago?.pagadoAt ? ` el ${formatDate(estadoPago.pagadoAt)}` : ""}. El reporte esta congelado.`
                      : "Abierto. El reporte se recalcula con ventas, entregas, semanas y configuraciones actuales."}
                  </p>
                {mostrarGestionDescuentos &&
                cantidadCambiosPendientes ? (
                  <p className="mt-1 text-xs font-semibold text-amber-700">
                    {cantidadCambiosPendientes} cambio(s) pendiente(s) de guardar.
                  </p>
                ) : null}
              </div>
            </div>

            <div
              className={`grid gap-3 sm:grid-cols-2 ${
                seccionActiva === "LOGISTICA"
                  ? "2xl:grid-cols-[190px_auto]"
                  : mostrarGestionDescuentos
                    ? "2xl:grid-cols-[190px_auto_auto_auto]"
                    : "2xl:grid-cols-[190px_auto_auto]"
              }`}
            >
              <select
                value={exportScope}
                onChange={(event) => setExportScope(event.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
              >
                {EXPORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {mostrarGestionDescuentos ? (
                <button
                  type="button"
                  onClick={guardarValoresDescuento}
                  disabled={
                    !cantidadCambiosPendientes ||
                    guardandoDescuentos ||
                    periodoPagado ||
                    loading
                  }
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                >
                  <Save size={16} />
                  {guardandoDescuentos
                    ? "Guardando todo..."
                    : `Guardar todo (${cantidadCambiosPendientes})`}
                </button>
              ) : null}
              <button
                type="button"
                onClick={exportarExcel}
                disabled={!report || exportandoExcel || cantidadCambiosPendientes > 0}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                <Download size={16} />
                {exportandoExcel ? "Exportando..." : "Exportar Excel"}
              </button>
              {seccionActiva !== "LOGISTICA" ? (
                <button
                  type="button"
                  onClick={marcarPeriodoPagado}
                  disabled={
                    !report ||
                    periodoPagado ||
                    pagandoPeriodo ||
                    loading ||
                    cantidadCambiosPendientes > 0
                  }
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                >
                  <Lock size={16} />
                  {periodoPagado
                    ? "Pagado"
                    : pagandoPeriodo
                      ? "Guardando..."
                      : "Marcar pagado"}
                </button>
              ) : null}
            </div>
          </div>
        </section>

        {seccionActiva !== "LOGISTICA" && seccionActiva !== "SUPERVISORES" ? (
        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div
            className={`grid gap-3 ${
              ["VENDEDORES", "SANCIONES"].includes(seccionActiva) ? "md:grid-cols-2" : "md:grid-cols-1"
            }`}
          >
            {["VENDEDORES", "SANCIONES"].includes(seccionActiva) ? (
              <label className="text-sm font-medium text-slate-700">
                Tipo de cargo
                <select
                  value={cargoFiltro}
                  onChange={(event) => {
                    setCargoFiltro(event.target.value);
                    setVendedorFiltro("");
                    setVendedorBusqueda("");
                    setColaboradoresOpen(false);
                  }}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="">Todos los cargos</option>
                  <option value="CALL_CENTER">Vendedor Call Center</option>
                  <option value="PISO">Vendedor de Piso</option>
                </select>
              </label>
            ) : null}
            <CollaboratorSearchInput
              options={colaboradoresCoincidentes}
              searchValue={vendedorBusqueda}
              selectedId={vendedorFiltro}
              open={colaboradoresOpen}
              placeholder={
                seccionActiva === "VENDEDORES"
                  ? "Todos los colaboradores del cargo"
                  : "Todos los colaboradores de la seccion"
              }
              onOpenChange={setColaboradoresOpen}
              onSearchChange={(value) => {
                setVendedorBusqueda(value);
                setVendedorFiltro("");
                setColaboradoresOpen(true);
              }}
              onShowAll={() => {
                setVendedorBusqueda("");
                setColaboradoresOpen(true);
              }}
              onSelect={(vendedor) => {
                setVendedorFiltro(String(vendedor.usuarioId));
                setVendedorBusqueda(vendedor.nombre || "");
                setColaboradoresOpen(false);
              }}
            />
          </div>
        </section>
        ) : null}

        {seccionActiva === "JEFES" ? (
        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div>
            <h2 className="font-semibold text-slate-900">Asignacion general de respaldo</h2>
            <p className="mt-1 text-sm text-slate-500">
              Esta asignacion se usa solamente cuando el equipo de una semana aun no ha sido configurado.
            </p>
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
            <label className="text-sm font-medium text-slate-700">
              Vendedor junior
              <select
                value={juniorId}
                onChange={(event) => seleccionarJunior(event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">Seleccione un vendedor</option>
                {vendedoresElegiblesEquipo.map((vendedor) => (
                  <option key={vendedor.usuarioId} value={vendedor.usuarioId}>
                    {vendedor.nombre} - {vendedor.cargoComision || vendedor.cargo || vendedor.rol || "Vendedor"}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-medium text-slate-700">
              Jefe comercial
              <select
                value={jefeComercialId}
                onChange={(event) => setJefeComercialId(event.target.value)}
                disabled={!juniorId}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
              >
                <option value="">Sin jefe asignado</option>
                {jefesComerciales.map((jefe) => (
                  <option key={jefe.usuarioId} value={jefe.usuarioId}>
                    {jefe.nombre}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={guardarJefeComercial}
              disabled={!juniorId || guardandoJefe}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {guardandoJefe ? "Guardando..." : "Guardar asignacion"}
            </button>
          </div>
        </section>
        ) : null}

        {seccionActiva === "SUPERVISORES" ? (
          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div>
              <h2 className="font-semibold text-slate-900">Asignacion general de respaldo</h2>
              <p className="mt-1 text-sm text-slate-500">
                Esta asignacion se usa solamente cuando el equipo de una semana aun no ha sido configurado.
              </p>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
              <CollaboratorSearchInput
                label="Vendedor junior"
                options={juniorsSupervisorCoincidentes}
                searchValue={juniorSupervisorBusqueda}
                selectedId={juniorSupervisorId}
                open={juniorSupervisorOpen}
                placeholder="Seleccione un vendedor"
                onOpenChange={setJuniorSupervisorOpen}
                onSearchChange={(value) => {
                  setJuniorSupervisorBusqueda(value);
                  setJuniorSupervisorId("");
                  setSupervisorComercialId("");
                  setJuniorSupervisorOpen(true);
                }}
                onShowAll={() => {
                  setJuniorSupervisorBusqueda("");
                  setJuniorSupervisorOpen(true);
                }}
                onSelect={(vendedor) => {
                  seleccionarJuniorSupervisor(String(vendedor.usuarioId));
                  setJuniorSupervisorBusqueda(vendedor.nombre || "");
                  setJuniorSupervisorOpen(false);
                }}
              />
              <label className="text-sm font-medium text-slate-700">
                Supervisor
                <select
                  value={supervisorComercialId}
                  onChange={(event) => setSupervisorComercialId(event.target.value)}
                  disabled={!juniorSupervisorId}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
                >
                  <option value="">Sin supervisor asignado</option>
                  {supervisoresComerciales.map((supervisor) => (
                    <option key={supervisor.usuarioId} value={supervisor.usuarioId}>
                      {supervisor.nombre} - {supervisor.cargo}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={guardarSupervisorComercial}
                disabled={!juniorSupervisorId || guardandoSupervisor}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                {guardandoSupervisor ? "Guardando..." : "Guardar asignacion"}
              </button>
            </div>
          </section>
        ) : null}

        {seccionActiva === "VENDEDORES" ? (
        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] border-collapse text-center text-sm text-slate-950">
              <thead>
                <tr>
                  <th
                    rowSpan={2}
                    className="sticky left-0 z-20 min-w-[240px] border border-slate-950 bg-white px-3 py-4 text-xl font-black"
                  >
                    {SECCIONES.find((seccion) => seccion.id === seccionActiva)?.label.toUpperCase()}
                  </th>
                  {weeks.map((week, index) => (
                    <th
                      key={week.startDate}
                      colSpan={WEEK_COLUMN_COUNT}
                      className={`border border-slate-950 px-3 py-2 text-lg font-black ${blockColors[index % blockColors.length]}`}
                    >
                      {week.label}
                    </th>
                  ))}
                  <MonthlyHeader />
                </tr>
                <tr>
                  {weeks.map((week, index) => (
                    <WeekHeader key={week.startDate} color={blockColors[index % blockColors.length]} />
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan={1 + weeks.length * WEEK_COLUMN_COUNT + MONTHLY_COLUMN_COUNT}
                      className="border border-slate-300 px-4 py-10 text-center text-slate-500"
                    >
                      Cargando reporte...
                    </td>
                  </tr>
                ) : vendedoresFiltrados.length ? (
                  vendedoresFiltrados.map((vendedor, index) => {
                    const cargosPagoLabel = getCargosPagoLabel(vendedor);
                    return (
                      <tr
                      key={vendedor.usuarioId}
                      className={
                        vendedor.fechaSalida
                          ? "bg-blue-50"
                          : index % 2 === 0
                            ? "bg-white"
                            : "bg-orange-100"
                      }
                    >
                      <td className="sticky left-0 z-10 border border-slate-950 bg-inherit px-3 py-1.5 text-left font-medium">
                        <div className="leading-tight">
                          <span>{vendedor.nombre}</span>
                          {vendedor.cargo ? (
                            <span className="block text-[11px] font-normal text-slate-500">
                              {vendedor.cargo}
                            </span>
                          ) : null}
                          {vendedor.tieneMultiplesCargos ? (
                            <>
                              {cargosPagoLabel ? (
                                <span className="block text-[10px] font-normal text-blue-700">
                                  {cargosPagoLabel}
                                </span>
                              ) : null}
                              <span className="block text-[10px] font-semibold text-emerald-700">
                                {vendedor.vistaVentasPersonales
                                  ? "Solo ventas personales; la comisión se liquida en Jefes comerciales"
                                  : `Comisión calculada como: ${
                                      vendedor.cargoComision || vendedor.cargo
                                    }`}
                              </span>
                            </>
                          ) : null}
                          {vendedor.fechaSalida ? (
                            <span className="mt-1 inline-block rounded bg-blue-600 px-2 py-0.5 text-[11px] font-semibold text-white">
                              Salida: {String(vendedor.fechaSalida).slice(0, 10)}
                            </span>
                          ) : null}
                          {vendedor.esJefeComercial ? (
                            <span className="block text-[11px] font-normal text-emerald-700">
                              {vendedor.vendedoresJunior?.length || 0} junior(s)
                              {vendedor.resumenMensual?.promedioVentasPorJunior !== null
                                ? ` · Promedio ${formatCommission(vendedor.resumenMensual?.promedioVentasPorJunior)}`
                                : ""}
                            </span>
                          ) : null}
                        </div>
                      </td>
                      {weeks.map((week) => (
                        <WeekValues
                          key={`${vendedor.usuarioId}-${week.startDate}`}
                          values={getWeekValues(vendedor, week)}
                          vendedor={vendedor}
                          week={week}
                          descuentoEditado={
                            descuentosEditados[`${vendedor.usuarioId}-${week.startDate}`]
                          }
                          onCambiarDescuento={cambiarValorDescuento}
                          onRestaurarDescuento={restaurarValorDescuento}
                          periodoPagado={periodoPagado}
                          guardando={guardandoDescuentos}
                        />
                      ))}
                      <MonthlyValues values={getMonthlyValues(vendedor)} />
                    </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td
                      colSpan={1 + weeks.length * WEEK_COLUMN_COUNT + MONTHLY_COLUMN_COUNT}
                      className="border border-slate-300 px-4 py-10 text-center text-slate-500"
                    >
                      No hay registros en esta seccion para el mes seleccionado.
                    </td>
                  </tr>
                )}

                {weeks.length ? (
                  <tr className="bg-fuchsia-500 font-black text-white">
                    <td className="sticky left-0 z-10 border border-slate-950 bg-fuchsia-500 px-3 py-1.5 text-left">
                      TOTAL
                    </td>
                    {weeks.map((week) => (
                      <WeekValues
                        key={`total-${week.startDate}`}
                        values={totalVisible.semanas?.[week.startDate] || emptyWeekValues}
                        total
                      />
                    ))}
                    <MonthlyValues values={getMonthlyValues(totalVisible)} total />
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
        ) : seccionActiva === "SANCIONES" ? (
          <SalesPenaltiesTable
            observaciones={report?.observacionesVendedores || {}}
            observacionesEditadas={observacionesEditadas}
            onCambiarObservacion={(usuarioId, value) => setObservacionesEditadas((actuales) => {
              const siguientes = { ...actuales };
              if (value === (report?.observacionesVendedores?.[usuarioId] || "")) delete siguientes[usuarioId];
              else siguientes[usuarioId] = value;
              return siguientes;
            })}
            onGuardarTodo={guardarValoresDescuento}
            cantidadCambiosPendientes={cantidadCambiosPendientes}
            rows={vendedoresFiltrados}
            weeks={weeks}
            loading={loading}
            descuentosEditados={descuentosEditados}
            onCambiarDescuento={cambiarValorDescuento}
            onRestaurarDescuento={restaurarValorDescuento}
            periodoPagado={periodoPagado}
            guardando={guardandoDescuentos || pagandoPeriodo}
          />
        ) : seccionActiva === "LOGISTICA" ? (
          <LogisticsCommissionTable
            rows={logistica}
            loading={loading}
          />
        ) : (
          <LeadershipCommissionTables
            rows={vendedoresFiltrados}
            weeks={weeks}
            loading={loading}
            vendedoresDisponibles={vendedoresElegiblesEquipo}
            onGuardarEquipoSemanal={guardarEquipoSemanal}
            onGuardarPromedioJefe={guardarPromedioJefeMensual}
            onGuardarPromedioSupervisor={guardarPromedioSupervisorMensual}
            guardandoEquipoSemanal={guardandoEquipoSemanal}
            guardandoPromedioJefe={guardandoPromedioJefe}
            guardandoPromedioSupervisor={guardandoPromedioSupervisor}
            periodoPagado={periodoPagado}
            sectionLabel={
              SECCIONES.find((seccion) => seccion.id === seccionActiva)?.label || ""
            }
          />
        )}
        {configOpen ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4 py-6">
            <section className="max-h-[90vh] w-full max-w-6xl overflow-hidden rounded-lg bg-white shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    Configuracion de mes
                  </h2>
                  <div className="mt-1 flex flex-wrap gap-3 text-sm text-slate-600">
                    <span>Año: {filters.year}</span>
                    <span>Semanas configuradas: {semanasConfiguradas}</span>
                    <span>Semanas requeridas: {semanasRequeridas || "-"}</span>
                    <span
                      className={
                        configuracionValida
                          ? "font-semibold text-emerald-700"
                          : "font-semibold text-red-700"
                      }
                    >
                      {configuracionValida
                        ? "Configuracion valida"
                        : "Configuracion invalida"}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setConfigOpen(false)}
                  className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                  title="Cerrar"
                >
                  <X size={20} />
                </button>
              </div>

              {!configuracionValida ? (
                <div className="mx-5 mt-4 flex gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  <AlertTriangle size={18} className="mt-0.5 shrink-0" />
                  <span>
                    Ajuste los meses para que la suma sea igual a las semanas
                    requeridas del calendario comercial anual.
                  </span>
                </div>
              ) : null}

              {configPastChanged ? (
                <div className="mx-5 mt-4 flex gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
                  <AlertTriangle size={18} className="mt-0.5 shrink-0" />
                  <span>
                    Cambiar esta configuracion recalculara las semanas y valores
                    del reporte de comisiones de este periodo.
                  </span>
                </div>
              ) : null}

              <div className="max-h-[58vh] overflow-auto p-5">
                {configLoading ? (
                  <div className="py-12 text-center text-sm text-slate-500">
                    Cargando configuracion...
                  </div>
                ) : (
                  <table className="w-full min-w-[820px] border-collapse text-left text-sm">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700">
                        <th className="border border-slate-200 px-3 py-2">Mes</th>
                        <th className="border border-slate-200 px-3 py-2">
                          Cantidad de semanas
                        </th>
                        <th className="border border-slate-200 px-3 py-2">
                          Fecha inicial
                        </th>
                        <th className="border border-slate-200 px-3 py-2">
                          Fecha final
                        </th>
                        <th className="border border-slate-200 px-3 py-2">Estado</th>
                        <th className="border border-slate-200 px-3 py-2">Accion</th>
                      </tr>
                    </thead>
                    <tbody>
                      {configMesesPreview.map((item) => {
                        const monthLabel =
                          MONTHS.find((month) => month.value === item.mes)?.label ||
                          item.mes;
                        const original = configOriginalMeses.find(
                          (row) => Number(row.mes) === Number(item.mes),
                        );
                        const changed =
                          original &&
                          Number(original.cantidadSemanas) !==
                            Number(item.cantidadSemanas);
                        return (
                          <tr key={item.mes} className="odd:bg-white even:bg-slate-50">
                            <td className="border border-slate-200 px-3 py-2 font-semibold text-slate-900">
                              {monthLabel}
                            </td>
                            <td className="border border-slate-200 px-3 py-2">
                              <select
                                value={item.cantidadSemanas}
                                onChange={(event) =>
                                  cambiarCantidadSemanas(
                                    item.mes,
                                    event.target.value,
                                  )
                                }
                                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                              >
                                <option value={4}>4 semanas</option>
                                <option value={5}>5 semanas</option>
                              </select>
                            </td>
                            <td className="border border-slate-200 px-3 py-2">
                              {formatDate(item.fechaInicio)}
                            </td>
                            <td className="border border-slate-200 px-3 py-2">
                              {formatDate(item.fechaFin)}
                            </td>
                            <td className="border border-slate-200 px-3 py-2">
                              <span
                                className={`rounded px-2 py-1 text-xs font-semibold ${
                                  item.configuradaManualmente
                                    ? "bg-emerald-100 text-emerald-700"
                                    : "bg-amber-100 text-amber-700"
                                }`}
                              >
                                {item.configuradaManualmente
                                  ? "Configurado"
                                  : "Fallback"}
                              </span>
                            </td>
                            <td className="border border-slate-200 px-3 py-2">
                              {changed ? (
                                <span className="text-xs font-semibold text-blue-700">
                                  Pendiente
                                </span>
                              ) : (
                                <span className="text-xs text-slate-400">
                                  Sin cambios
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              <div className="flex flex-col gap-3 border-t border-slate-200 px-5 py-4 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setConfigOpen(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={guardarConfiguracionAnual}
                  disabled={!configuracionValida || configSaving || configLoading}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                >
                  <Save size={16} />
                  {configSaving ? "Guardando..." : "Guardar"}
                </button>
              </div>
            </section>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function SalesPenaltyAmount({
  vendedor,
  week,
  values,
  descuentoEditado,
  onCambiarDescuento,
  onRestaurarDescuento,
  periodoPagado,
  guardando,
}) {
  const editable = Boolean(
    onCambiarDescuento && !periodoPagado &&
    !values.semanaFutura && values.semanaLaborada !== false &&
    values.semanaCompletaParaDescuento && Number(values.valorMultaCalculado || 0) > 0,
  );
  const valorInput = descuentoEditado
    ? descuentoEditado.valorDescontar
    : Number(values.valorDescontar || 0).toFixed(2);
  const invalido = parseValorDescuentoInput(valorInput) === null;

  if (!editable) {
    return (
      <span className={`font-bold ${Number(values.valorDescontar || 0) > 0 ? "text-red-700" : "text-slate-600"}`}>
        {formatCurrency(values.valorDescontar)}
      </span>
    );
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <label className="flex items-center gap-1 font-bold text-red-700">
        <span aria-hidden="true">$</span>
        <input
          type="text"
          inputMode="decimal"
          value={valorInput}
          disabled={guardando}
          maxLength={13}
          placeholder="0.00"
          aria-label={`Valor a descontar de ${vendedor.nombre} en ${week.label}`}
          aria-invalid={invalido}
          onChange={(event) => {
            const value = event.target.value;
            if (esFormatoValorDescuentoInputValido(value)) {
              onCambiarDescuento({ vendedor, week, values, value });
            }
          }}
          className={`h-6 w-20 max-w-full rounded border bg-white px-1 text-right text-xs tabular-nums outline-none focus:ring-2 disabled:opacity-60 ${
            invalido ? "border-red-600 focus:ring-red-200"
              : descuentoEditado ? "border-amber-500 text-amber-800 focus:ring-amber-200"
                : "border-slate-300 focus:ring-emerald-200"
          }`}
        />
      </label>
      {invalido ? <span className="text-[11px] text-red-700">Ingrese un valor válido, mayor o igual a 0.</span> : null}
      {descuentoEditado ? <span className="text-[11px] font-semibold text-amber-700">Pendiente de guardar</span> : null}
      {(values.descuentoModificado || descuentoEditado) && onRestaurarDescuento ? (
        <button
          type="button"
          disabled={guardando}
          onClick={() => onRestaurarDescuento({ vendedor, week, values })}
          className="text-[11px] font-semibold text-emerald-700 underline disabled:opacity-60"
        >
          Usar sanción calculada
        </button>
      ) : null}
    </div>
  );
}

function SalesPenaltiesTable({
  rows,
  weeks,
  loading,
  observaciones = {},
  observacionesEditadas = {},
  onGuardarTodo,
  cantidadCambiosPendientes = 0,
  onCambiarObservacion,
  descuentosEditados = {},
  onCambiarDescuento,
  onRestaurarDescuento,
  periodoPagado = false,
  guardando = false,
}) {
  const total = roundMoney(rows.reduce((sum, row) => sum + getPenaltyTotal(row, weeks), 0));

  return (
    <section className="overflow-hidden border border-slate-300 bg-white shadow-sm">
      <div className="border-b border-slate-300 bg-slate-100 px-3 py-3">
        <h2 className="text-sm font-bold text-slate-950">Sanción por no llegar a meta</h2>
        <p className="mt-1 text-xs text-slate-600">
          Valor a descontar por cada semana comercial, según la meta y la sanción configuradas.
          {periodoPagado
            ? " El período está pagado y sus valores no se pueden editar."
            : " Las unidades se calculan desde las ventas y metas. Edite el importe o la observación y pulse Guardar todo. Puede ingresar 0 para omitir la sanción."}
          {Object.keys(descuentosEditados).length > 0
            ? " Los totales muestran una vista previa de los cambios pendientes."
            : " Los valores incluyen los ajustes guardados."}
        </p>
      </div>
      <div className="max-h-[calc(100vh-250px)] min-h-[480px] overflow-auto">
        <table className="w-full min-w-[1840px] border-collapse text-center text-xs text-slate-950">
          <thead className="sticky top-0 z-20 text-slate-950">
            <tr>
              <th scope="col" rowSpan={2} className="sticky left-0 z-20 min-w-[200px] border border-slate-950 bg-sky-100 px-2 py-2 text-left font-bold">
                Vendedor
              </th>
              {weeks.map((week) => (
                <th key={week.startDate} scope="colgroup" colSpan={3} className={`min-w-[160px] border border-slate-950 bg-sky-200 px-2 py-2 font-bold`}>
                  {week.label}
                </th>
              ))}
              <th scope="col" rowSpan={2} className="border border-slate-950 bg-sky-100 px-3 py-2 font-black">
                Total sanciones del mes
              </th>
              <th scope="col" rowSpan={2} className="min-w-[220px] border border-slate-950 bg-sky-100 px-2 py-2 font-bold">Observación</th>
            </tr>
            <tr>
              {weeks.map((week) => (
                <Fragment key={week.startDate}>
                  {["Unidades vendidas", "Unidades faltantes para meta", "Valor a descontar"].map((label) => (
                    <th key={label} scope="col" className={`min-w-[90px] border border-slate-950 bg-sky-100 px-2 py-2 font-bold`}>
                      {label}
                    </th>
                  ))}
                </Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading || !rows.length ? (
              <tr>
                <td colSpan={weeks.length * 3 + 3} className="px-4 py-10 text-slate-500">
                  {loading ? "Cargando reporte..." : "No hay registros en esta sección para el mes seleccionado."}
                </td>
              </tr>
            ) : rows.map((row, index) => (
              <tr key={row.usuarioId} className={row.fechaSalida ? "bg-blue-50 hover:bg-blue-100" : index % 2 === 0 ? "bg-emerald-50/70 hover:bg-emerald-100" : "bg-white hover:bg-emerald-50"}>
                <th scope="row" className="sticky left-0 z-10 border border-slate-950 bg-inherit px-2 py-1.5 text-left font-bold">
                  {row.nombre}
                  <span className="block text-[11px] font-normal text-slate-500">{row.cargoComision || row.cargo}</span>
                </th>
                {weeks.map((week) => {
                  const values = getPenaltyWeekValues(row, week);
                  const estado = values.semanaFutura
                    ? "Pendiente"
                    : values.semanaLaborada === false
                      ? "No laborada"
                      : values.semanaCompletaParaDescuento === false
                        ? "Semana parcial"
                        : null;
                  return (
                    <Fragment key={week.startDate}>
                      <td className="border border-slate-950 px-2 py-1.5 font-semibold tabular-nums">
                        {values.semanaFutura ? "-" : Number(values.venden || 0)}
                      </td>
                      <td className="border border-slate-950 px-2 py-1.5 font-semibold tabular-nums">
                        {estado ? "-" : Number(values.noCumpleMetas || 0)}
                      </td>
                      <td className="border border-slate-950 px-2 py-1.5 font-semibold tabular-nums">
                      {estado ? <span className="text-xs text-slate-500">{estado}</span> : (
                        <>
                          <SalesPenaltyAmount
                            vendedor={row}
                            week={week}
                            values={values}
                            descuentoEditado={descuentosEditados[`${row.usuarioId}-${week.startDate}`]}
                            onCambiarDescuento={onCambiarDescuento}
                            onRestaurarDescuento={onRestaurarDescuento}
                            periodoPagado={periodoPagado}
                            guardando={guardando}
                          />
                          {values.descuentoModificado && !descuentosEditados[`${row.usuarioId}-${week.startDate}`] ? (
                            <span className="block text-[11px] text-slate-500">
                              {values.multaOmitida ? "Sanción omitida" : "Valor ajustado"} · Calculado: {formatCurrency(values.valorMultaCalculado)}
                            </span>
                          ) : null}
                        </>
                      )}
                      </td>
                    </Fragment>
                  );
                })}
                <td className="border border-slate-950 bg-rose-50 px-2 py-1.5 text-right font-extrabold text-rose-800 tabular-nums">
                  {formatCurrency(getPenaltyTotal(row, weeks))}
                </td>
                <td className="border border-slate-950 px-2 py-1.5 font-semibold tabular-nums">
                  <textarea
                    aria-label={`Observación de ${row.nombre}`}
                    value={observacionesEditadas[row.usuarioId] ?? observaciones[row.usuarioId] ?? ""}
                    onChange={(event) => onCambiarObservacion(row.usuarioId, event.target.value)}
                    disabled={periodoPagado || guardando || loading}
                    maxLength={5000}
                    rows={1}
                    placeholder="Observación del vendedor"
                    className="h-6 min-h-6 w-full min-w-[200px] resize-y rounded border border-slate-300 bg-white px-1 py-0.5 text-xs font-normal focus:outline-none focus:ring-2 focus:ring-emerald-200 disabled:opacity-60"
                  />
                  {Object.hasOwn(observacionesEditadas, row.usuarioId) ? <span className="block text-xs font-semibold text-amber-700">Pendiente de guardar</span> : null}
                </td>
              </tr>
            ))}
          </tbody>
          {!loading && rows.length > 0 && weeks.length > 0 ? (
            <tfoot className="sticky bottom-0 z-10 bg-sky-700 text-white">
              <tr className="bg-sky-700 font-black text-white">
                <th scope="row" className="sticky left-0 z-10 border border-slate-950 bg-sky-700 px-3 py-2 text-left">TOTAL</th>
                {weeks.map((week) => (
                  <Fragment key={week.startDate}>
                    {["venden", "noCumpleMetas"].map((field) => (
                      <td key={field} className="border border-slate-950 px-2 py-1.5 font-semibold tabular-nums">
                        {rows.every((row) => getPenaltyWeekValues(row, week).semanaFutura)
                          ? "-"
                          : rows.reduce((sum, row) => sum + Number(getPenaltyWeekValues(row, week)[field] || 0), 0)}
                      </td>
                    ))}
                    <td className="border border-slate-950 px-2 py-1.5 font-semibold tabular-nums">
                    {rows.every((row) => getPenaltyWeekValues(row, week).semanaFutura)
                      ? "-"
                      : formatCurrency(rows.reduce((sum, row) => sum + Number(getPenaltyWeekValues(row, week).valorDescontar || 0), 0))}
                    </td>
                  </Fragment>
                ))}
                <td className="border border-slate-950 px-2 py-1.5 font-semibold tabular-nums">{formatCurrency(total)}</td>
                <td className="border border-slate-950" />
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
      <div className="flex items-center justify-end gap-3 border-t border-slate-300 bg-slate-100 px-3 py-3">
        <span className="text-xs text-slate-600">{cantidadCambiosPendientes} cambio(s) pendiente(s)</span>
        <button type="button" onClick={onGuardarTodo}
          disabled={!cantidadCambiosPendientes || periodoPagado || guardando || loading}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">
          <Save size={16} />{guardando ? "Guardando todo..." : "Guardar todo"}
        </button>
      </div>
    </section>
  );
}

function WeeklyLeaderTeamConfiguration({
  leader,
  weeks,
  sellers,
  onSave,
  savingKey,
  disabled,
}) {
  return (
    <div className="border-b border-slate-200 bg-slate-50 px-4 py-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-900">
            Vendedores a cargo por semana
          </h3>
          <p className="text-xs text-slate-600">
            La seleccion guardada se usa para dispositivos por vendedor y para el
            calculo del promedio de esa semana.
          </p>
          {leader.tieneMultiplesCargos ? (
            <p className="mt-1 text-xs font-medium text-blue-700">
              Las ventas propias del jefe se incluyen automaticamente.
            </p>
          ) : null}
        </div>
        {disabled ? (
          <span className="inline-flex w-fit items-center gap-1 rounded bg-slate-200 px-2 py-1 text-xs font-semibold text-slate-700">
            <Lock size={13} /> Periodo pagado
          </span>
        ) : null}
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {weeks.map((week) => (
          <WeeklyTeamCard
            key={`${leader.usuarioId}-${week.startDate}`}
            leader={leader}
            week={week}
            sellers={sellers}
            onSave={onSave}
            savingKey={savingKey}
            disabled={disabled}
          />
        ))}
      </div>
    </div>
  );
}

function MonthlyLeaderAverageConfiguration({
  leader,
  leaderType,
  sellers,
  weeks,
  onSave,
  savingKey,
  disabled,
}) {
  const resumen = leader.resumenMensual || {};
  const isChief = leaderType === "jefe";
  const configured = Boolean(
    isChief
      ? resumen.promedioJefeMensualConfigurado
      : resumen.promedioSupervisorMensualConfigurado,
  );
  const configuredIds = isChief
    ? resumen.vendedorIdsPromedioJefe
    : resumen.vendedorIdsPromedioSupervisor;
  const defaultIds = (isChief
    ? resumen.vendedoresConsideradosBono || leader.vendedoresBono || []
    : leader.vendedoresJunior || []
  ).map((vendedor) => String(vendedor.usuarioId));
  const savedIds = [
    ...new Set(
      (configured
        ? configuredIds || []
        : defaultIds
      ).map((id) => String(id)),
    ),
  ].sort((a, b) => Number(a) - Number(b));
  const savedSignature = savedIds.join(",");
  const [selectedIds, setSelectedIds] = useState(savedIds);

  useEffect(() => {
    setSelectedIds(savedSignature ? savedSignature.split(",") : []);
  }, [savedSignature]);

  const selectedSignature = [...selectedIds]
    .sort((a, b) => Number(a) - Number(b))
    .join(",");
  const isSaving = savingKey === String(leader.usuarioId);
  const isBusy = Boolean(savingKey);
  const hasChanges = !configured || selectedSignature !== savedSignature;
  const availableSellers = sellers.filter((seller) =>
    weeks.some((week) => isSellerAvailableForWeek(seller, week)),
  );
  const selectedCount = selectedIds.length;
  const promedioCalculado = selectedCount && weeks.length
    ? Number(resumen.ventasConsideradasBono || 0) / weeks.length / selectedCount
    : 0;

  const toggleSeller = (sellerId) => {
    const id = String(sellerId);
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((currentId) => currentId !== id)
        : [...current, id],
    );
  };

  return (
    <div className="border-b border-slate-200 bg-blue-50 px-4 py-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-900">
            Vendedores para promedio mensual
          </h3>
          <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-600">
            <span>Dispositivos: {formatCommission(resumen.ventasConsideradasBono || 0)}</span>
            <span>Semanas: {weeks.length}</span>
            <span>Seleccionados: {selectedCount}</span>
            <span>Promedio: {formatCommission(promedioCalculado)}</span>
          </div>
            <p className="mt-1 text-xs text-slate-600">
              Promedio = ventas elegibles de los equipos semanales ÷ semanas ÷ vendedores del promedio mensual. Si el vendedor sigue activo, sin fecha de salida, y ya supera 15 días desde su ingreso, también cuentan sus ventas iniciales.
            </p>
        </div>
        {disabled ? (
          <span className="inline-flex w-fit items-center gap-1 rounded bg-slate-200 px-2 py-1 text-xs font-semibold text-slate-700">
            <Lock size={13} /> Periodo pagado
          </span>
        ) : null}
      </div>

      <div className="mt-3 max-h-44 space-y-1 overflow-y-auto rounded border border-blue-200 bg-white p-2">
        {availableSellers.length ? (
          availableSellers.map((seller) => {
            const id = String(seller.usuarioId);
            const detalleCargo =
              seller.cargoComision || seller.cargo || seller.rol || "Vendedor";
            return (
              <label
                key={seller.usuarioId}
                className="flex cursor-pointer items-start gap-2 rounded px-1 py-1 text-xs text-slate-700 hover:bg-blue-50"
              >
                <input
                  type="checkbox"
                  checked={selectedIds.includes(id)}
                  onChange={() => toggleSeller(id)}
                  disabled={disabled || isBusy}
                  className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed"
                />
                <span className="min-w-0">
                  <span className="block font-medium text-slate-800">
                    {seller.nombre}
                  </span>
                  <span className="block truncate text-[10px] text-slate-500">
                    {detalleCargo}
                  </span>
                </span>
              </label>
            );
          })
        ) : (
          <p className="py-2 text-center text-xs text-slate-500">
            No hay vendedores disponibles para el periodo.
          </p>
        )}
      </div>

      <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setSelectedIds(availableSellers.map((seller) => String(seller.usuarioId)))}
            disabled={disabled || isBusy || !availableSellers.length}
            className="rounded border border-blue-300 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Seleccionar todos
          </button>
          <button
            type="button"
            onClick={() => setSelectedIds([])}
            disabled={disabled || isBusy || !selectedIds.length}
            className="rounded border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Limpiar
          </button>
        </div>
        <button
          type="button"
          onClick={() =>
            onSave({
              [isChief ? "jefe" : "supervisor"]: leader,
              vendedorIds: selectedIds.map(Number),
            })
          }
          disabled={disabled || isBusy || !hasChanges}
          className="inline-flex items-center justify-center gap-1 rounded bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Save size={13} />
          {isSaving ? "Guardando..." : "Guardar promedio"}
        </button>
      </div>
    </div>
  );
}

function WeeklyTeamCard({
  leader,
  week,
  sellers,
  onSave,
  savingKey,
  disabled,
}) {
  const values = getWeekValues(leader, week);
  const configured = Boolean(values.equipoSemanalConfigurado);
  const sellersForWeek = leader.esSupervisorComercial
    ? sellers.filter((seller) => isSellerAvailableForWeek(seller, week))
    : sellers;
  const sellerIdsForWeek = new Set(
    sellersForWeek.map((seller) => String(seller.usuarioId)),
  );
  const savedIds = [...new Set(
    (values.vendedorIdsSeleccionados || []).map((id) => String(id)),
  )]
    .filter((id) => !leader.esSupervisorComercial || sellerIdsForWeek.has(id))
    .sort((a, b) => Number(a) - Number(b));
  const savedSignature = savedIds.join(",");
  const [selectedIds, setSelectedIds] = useState(savedIds);

  useEffect(() => {
    setSelectedIds(savedSignature ? savedSignature.split(",") : []);
  }, [savedSignature]);

  const selectedSignature = [...selectedIds]
    .sort((a, b) => Number(a) - Number(b))
    .join(",");
  const key = `${leader.usuarioId}-${week.startDate}`;
  const isSaving = savingKey === key;
  const isBusy = Boolean(savingKey);
  const hasChanges = !configured || selectedSignature !== savedSignature;

  const toggleSeller = (sellerId) => {
    const id = String(sellerId);
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((currentId) => currentId !== id)
        : [...current, id],
    );
  };

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-bold text-slate-800">{week.label}</h4>
        <span
          className={`rounded px-2 py-0.5 text-[11px] font-semibold ${
            configured
              ? "bg-emerald-100 text-emerald-800"
              : "bg-amber-100 text-amber-800"
          }`}
        >
          {configured ? "Configurado" : "Asignacion general"}
        </span>
      </div>

      <div className="mt-2 max-h-40 space-y-1 overflow-y-auto rounded border border-slate-200 p-2">
        {sellersForWeek.length ? (
          sellersForWeek.map((seller) => {
            const id = String(seller.usuarioId);
            const detalleCargo =
              seller.cargoComision || seller.cargo || seller.rol || "Vendedor";
            return (
              <label
                key={seller.usuarioId}
                className="flex cursor-pointer items-start gap-2 rounded px-1 py-1 text-xs text-slate-700 hover:bg-slate-50"
              >
                <input
                  type="checkbox"
                  checked={selectedIds.includes(id)}
                  onChange={() => toggleSeller(id)}
                  disabled={disabled || isBusy}
                  className="mt-0.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 disabled:cursor-not-allowed"
                />
                <span className="min-w-0">
                  <span className="block font-medium text-slate-800">
                    {seller.nombre}
                  </span>
                  <span className="block truncate text-[10px] text-slate-500">
                    {detalleCargo}
                  </span>
                </span>
              </label>
            );
          })
        ) : (
          <p className="py-2 text-center text-xs text-slate-500">
            No hay vendedores disponibles para esta semana.
          </p>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-xs text-slate-500">
          {selectedIds.length} seleccionado{selectedIds.length === 1 ? "" : "s"}
        </span>
        <button
          type="button"
          onClick={() =>
            onSave({
              jefe: leader,
              week,
              vendedorIds: selectedIds.map(Number),
            })
          }
          disabled={disabled || isBusy || !hasChanges}
          className="inline-flex items-center gap-1 rounded bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Save size={13} />
          {isSaving ? "Guardando..." : "Guardar semana"}
        </button>
      </div>
    </article>
  );
}

function LogisticsCommissionTable({ rows, loading }) {
  if (loading || !rows.length) {
    return (
      <section className="border border-slate-300 bg-white px-4 py-16 text-center text-sm text-slate-500 shadow-sm">
        {loading ? "Cargando reporte..." : "No hay personal activo de logística para el período seleccionado."}
      </section>
    );
  }

  return (
    <div className="space-y-5">
      {getLogisticsTables(rows).map(({ manager, people, totalDeliveries }) => (
        <section key={manager?.usuarioId || "sin-encargado"} className="overflow-hidden border border-slate-300 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-300 bg-slate-100 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Entregas de logística</h3>
              <p className="mt-0.5 text-xs text-slate-600">
                {manager ? `Encargado: ${manager.nombre}` : "Equipo de choferes"}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
              <span className="rounded-full border border-slate-300 bg-white px-3 py-1 text-slate-700">
                {people.length} colaboradores
              </span>
              {manager ? (
                <span className="rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-emerald-800 tabular-nums">
                  A recibir encargado {formatCurrency(manager.resumenMensual?.totalPagar)}
                </span>
              ) : null}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table style={{ minWidth: Math.max(680, 260 + people.length * 140) }} className="w-full table-fixed border-collapse text-center text-xs text-slate-950">
              <caption className="sr-only">Entregas del período por encargado y chofer</caption>
              <thead>
                <tr>
                  <th scope="col" className="w-[260px] border border-slate-950 bg-sky-100 px-3 py-3 text-left font-bold">ENCARGADO LOGÍSTICA</th>
                  {people.map((person) => (
                    <th key={person.usuarioId} scope="col" title={person.cargo} className="min-w-[140px] border border-slate-950 bg-sky-200 px-3 py-3 font-bold uppercase">
                      {person.nombre}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="bg-white hover:bg-emerald-50">
                  <th scope="row" className="border border-slate-950 px-3 py-3 text-left font-semibold uppercase">
                    {manager?.nombre || "Sin encargado asignado"}
                  </th>
                  {people.map((person) => (
                    <td key={person.usuarioId} title={`Entregas de ${person.nombre}`} className="border border-slate-950 px-3 py-3 text-right text-sm font-bold tabular-nums">
                      {formatMoney(person.resumenMensual?.totalEntregas)}
                    </td>
                  ))}
                </tr>
                {manager && (
                  <tr className="bg-emerald-50/70 hover:bg-emerald-100">
                    <th scope="row" className="border border-slate-950 px-3 py-3 text-left font-semibold text-emerald-900">Entregas propias del encargado</th>
                    <td title="Entregas propias del encargado" className="border border-slate-950 bg-emerald-100 px-3 py-3 text-right text-sm font-extrabold text-emerald-900 tabular-nums">
                      {formatMoney(manager.resumenMensual?.totalEntregas)}
                    </td>
                    {people.slice(1).map((person) => <td key={person.usuarioId} className="border border-slate-950" />)}
                  </tr>
                )}
              </tbody>
            </table>
            {manager && (
              <table style={{ minWidth: Math.max(680, 260 + people.length * 140) }} className="w-full table-fixed border-collapse text-xs text-slate-950">
                <caption className="sr-only">Resumen de comisión del encargado {manager.nombre}</caption>
                <thead>
                  <tr className="bg-sky-100">
                    <th scope="col" className="w-[260px] border border-slate-950 px-3 py-3 text-left">RESUMEN DEL ENCARGADO</th>
                    <th scope="col" className="border border-slate-950 px-3 py-3 text-right">TOTAL ENTREGAS</th>
                    <th scope="col" className="border border-slate-950 bg-sky-200 px-3 py-3 text-right">
                      BONO DEL ENCARGADO
                    </th>
                    <th scope="col" className="border border-slate-950 bg-sky-300 px-3 py-3 text-right">A RECIBIR ENCARGADO</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="bg-sky-700 font-extrabold text-white">
                    <th scope="row" className="border border-slate-950 px-3 py-3 text-left uppercase">Totales</th>
                    <td title="Total de entregas del encargado y choferes" className="border border-slate-950 px-3 py-3 text-right text-sm tabular-nums">{formatMoney(totalDeliveries)}</td>
                    <td title="Bono del encargado: total de entregas dividido para 2" className="border border-slate-950 px-3 py-3 text-right text-sm tabular-nums">{formatCurrency(manager.resumenMensual?.totalBonoJuniors)}</td>
                    <td title="Total a pagar al encargado" className="border border-slate-950 px-3 py-3 text-right text-base tabular-nums">{formatCurrency(manager.resumenMensual?.totalPagar)}</td>
                  </tr>
                </tbody>
              </table>
            )}
          </div>
          {!manager && <p className="border-t border-slate-300 bg-slate-50 p-3 text-sm text-slate-500">No hay un usuario activo con cargo de encargado o jefe de logística en este período.</p>}
        </section>
      ))}
    </div>
  );
}

function LeadershipCommissionTables({
  rows,
  weeks,
  loading,
  sectionLabel,
  vendedoresDisponibles,
  onGuardarEquipoSemanal,
  onGuardarPromedioJefe,
  onGuardarPromedioSupervisor,
  guardandoEquipoSemanal,
  guardandoPromedioJefe,
  guardandoPromedioSupervisor,
  periodoPagado,
}) {
  if (loading) {
    return (
      <section className="rounded-lg border border-slate-200 bg-white p-10 text-center text-slate-500 shadow-sm">
        Cargando reporte...
      </section>
    );
  }

  if (!rows.length) {
    return (
      <section className="rounded-lg border border-slate-200 bg-white p-10 text-center text-slate-500 shadow-sm">
        No hay registros en {sectionLabel.toLowerCase()} para el mes seleccionado.
      </section>
    );
  }

  return (
    <div className="space-y-5">
      {rows.map((row) => {
        const mensual = getMonthlyValues(row);
        const personalNuevo = isPersonalNuevoEnReporte(row, weeks);
        const fechaIngreso = getFechaIngresoVisible(row);
        const cargosPagoLabel = getCargosPagoLabel(row);
        return (
          <section
            key={row.usuarioId}
            className={`overflow-hidden rounded-lg border bg-white shadow-sm ${
              row.fechaSalida || personalNuevo || row.tieneMultiplesCargos
                ? "border-blue-500 ring-2 ring-blue-100"
                : "border-slate-200"
            }`}
          >
            <div className="border-b border-slate-200 px-4 py-3">
              <h2 className="text-center text-lg font-black uppercase text-slate-900">
                Comisiones {row.nombre}
              </h2>
              {row.tieneMultiplesCargos ? (
                <div className="mt-1 text-center">
                  {cargosPagoLabel ? (
                    <p className="mt-1 text-xs font-semibold text-blue-700">
                      {cargosPagoLabel}
                    </p>
                  ) : null}
                </div>
              ) : null}
              {personalNuevo ? (
                <p className="mt-1 text-center">
                  <span className="inline-block rounded bg-blue-600 px-2 py-1 text-xs font-bold text-white">
                    Personal nuevo · aplica multa
                    {fechaIngreso
                      ? ` · Fecha de ingreso: ${String(fechaIngreso).slice(0, 10)}`
                      : ""}
                  </span>
                </p>
              ) : null}
              {row.fechaSalida ? (
                <p className="mt-1 text-center">
                  <span className="inline-block rounded bg-blue-600 px-2 py-1 text-xs font-bold text-white">
                    Fecha de salida: {String(row.fechaSalida).slice(0, 10)}
                  </span>
                </p>
              ) : null}
              {row.vendedoresJunior?.length ? (
                <p className="mt-1 text-center text-xs text-slate-500">
                  Vendedores considerados:{" "}
                  {row.vendedoresJunior
                    .map((vendedor) =>
                      vendedor.esLiderVendedor
                        ? `${vendedor.nombre} (doble cargo)`
                        : vendedor.nombre,
                    )
                    .join(", ")}
                  {mensual.promedioVentasPorJunior !== null
                    ? ` · Promedio por vendedor: ${formatCommission(mensual.promedioVentasPorJunior)}`
                    : ""}
                </p>
              ) : null}
              {row.esJefeComercial ? (
                <div className="mt-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-center text-xs">
                  <p className="font-semibold text-emerald-800">
                    Vendedores en el divisor del promedio:{" "}
                    {mensual.vendedoresConsideradosBono?.length
                      ? mensual.vendedoresConsideradosBono
                          .map((vendedor) => vendedor.nombre)
                          .join(", ")
                      : "Sin vendedores elegibles"}
                    {" · "}
                    {mensual.ventasConsideradasBono || 0} dispositivos de los equipos semanales que cumplen la condición de antigüedad
                  </p>
                  {mensual.vendedoresExcluidosBono?.length ? (
                    <p className="mt-1 text-amber-800">
                      No incluidos en el divisor del promedio:{" "}
                      {mensual.vendedoresExcluidosBono
                        .map(
                          (vendedor) =>
                            `${vendedor.nombre} (${vendedor.razones.join(", ")})`,
                        )
                        .join("; ")}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
            {row.esJefeComercial || row.esSupervisorComercial ? (
              <MonthlyLeaderAverageConfiguration
                leader={row}
                leaderType={row.esJefeComercial ? "jefe" : "supervisor"}
                sellers={vendedoresDisponibles.filter(
                  (vendedor) => Number(vendedor.usuarioId) !== Number(row.usuarioId),
                )}
                weeks={weeks}
                onSave={
                  row.esJefeComercial
                    ? onGuardarPromedioJefe
                    : onGuardarPromedioSupervisor
                }
                savingKey={
                  row.esJefeComercial
                    ? guardandoPromedioJefe
                    : guardandoPromedioSupervisor
                }
                disabled={periodoPagado}
              />
            ) : null}
            {row.esJefeComercial || row.esSupervisorComercial ? (
              <WeeklyLeaderTeamConfiguration
                leader={row}
                weeks={weeks}
                sellers={vendedoresDisponibles.filter(
                  (vendedor) => Number(vendedor.usuarioId) !== Number(row.usuarioId),
                )}
                onSave={onGuardarEquipoSemanal}
                savingKey={guardandoEquipoSemanal}
                disabled={periodoPagado}
              />
            ) : null}
            <div className="overflow-x-auto p-4">
              <table className="w-full min-w-[760px] border-collapse text-center text-sm text-slate-950">
                <thead>
                  <tr>
                    <th className="border border-slate-950 px-3 py-2" />
                    {weeks.map((week, index) => (
                      <th key={week.startDate} className={`border border-slate-950 px-3 py-2 font-black ${blockColors[index % blockColors.length]}`}>
                        {week.label}
                        {row.esJefeComercial || row.esSupervisorComercial ? (
                          <label className="mt-2 block text-[11px] font-semibold normal-case">
                            Comisión según
                            <select
                              aria-label={`Vendedores para comisión de ${row.nombre} en ${week.label}`}
                              value={getWeekValues(row, week).cantidadVendedoresComision ?? ""}
                              disabled={periodoPagado || Boolean(guardandoEquipoSemanal)}
                              onChange={(event) => onGuardarEquipoSemanal({
                                jefe: row,
                                week,
                                vendedorIds: (getWeekValues(row, week).vendedorIdsSeleccionados || []).filter((id) => Number(id) !== Number(row.usuarioId)),
                                cantidadVendedoresComision: event.target.value === "" ? null : Number(event.target.value),
                              })}
                              className="mx-auto mt-1 block h-7 max-w-full rounded border border-slate-300 bg-white px-1 text-xs font-semibold text-slate-900 outline-none focus:border-emerald-600 disabled:opacity-50"
                            >
                              <option value="">
                                {getWeekValues(row, week).cantidadVendedores ?? 0} vendedor{Number(getWeekValues(row, week).cantidadVendedores) === 1 ? "" : "es"}
                              </option>
                              {[1, 2, 3, 4, 5].map((cantidad) => (
                                <option key={cantidad} value={cantidad}>{cantidad} vendedor{cantidad === 1 ? "" : "es"}</option>
                              ))}
                            </select>
                            {guardandoEquipoSemanal === `${row.usuarioId}-${week.startDate}` ? (
                              <span role="status" className="mt-1 block text-[10px] font-normal">Guardando y calculando...</span>
                            ) : null}
                          </label>
                        ) : null}
                      </th>
                    ))}
                    <th className="border border-slate-950 bg-amber-100 px-3 py-2 font-black">COMISIÓN SEMANAL</th>
                    <th className="border border-slate-950 px-3 py-2 font-black">BONO MENSUAL</th>
                    <th className="border border-slate-950 bg-red-600 px-3 py-2 font-black text-white">TOTAL</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-slate-950 px-3 py-2 font-bold uppercase">{row.nombre}</td>
                    {weeks.map((week) => {
                      const values = getWeekValues(row, week);
                      return <td key={week.startDate} className="border border-slate-950 px-3 py-2 text-xl">{values.semanaFutura ? "-" : values.venden || 0}</td>;
                    })}
                    <td className="border border-slate-950 bg-amber-100 px-3 py-2" />
                    <td className="border border-slate-950 px-3 py-2" />
                    <td className="border border-slate-950 bg-red-600 px-3 py-2 text-white" />
                  </tr>
                  {row.esJefeComercial || row.esSupervisorComercial ? (
                    <tr className="font-bold">
                      <td className="border border-slate-950 bg-emerald-700 px-3 py-2 text-white">
                        DISPOSITIVOS POR VENDEDOR
                      </td>
                      {weeks.map((week) => {
                        const values = getWeekValues(row, week);
                        const vendedores = values.vendedoresActivos || [];
                        return (
                          <td
                            key={`ventas-vendedor-${week.startDate}`}
                            className="border border-slate-950 bg-emerald-50 px-2 py-2 text-emerald-900"
                          >
                            {values.semanaFutura
                              ? "-"
                              : vendedores.length
                                ? (
                                  <div className="flex flex-col gap-1">
                                    {vendedores.map((vendedor) => (
                                      <span
                                        key={vendedor.usuarioId}
                                        className="rounded bg-emerald-100 px-2 py-1 text-xs font-semibold"
                                      >
                                        {vendedor.nombre}: {vendedor.venden || 0}
                                        {vendedor.esLiderVendedor
                                          ? " (doble cargo)"
                                          : ""}
                                      </span>
                                    ))}
                                  </div>
                                )
                                : "Sin vendedores"}
                          </td>
                        );
                      })}
                      <td
                        colSpan={3}
                        className="border border-slate-950 bg-emerald-50 px-3 py-2 text-xs text-emerald-800"
                      >
                        Ventas individuales incluidas en el total del {row.esJefeComercial ? "jefe" : "supervisor"}
                      </td>
                    </tr>
                  ) : null}
                  <tr className="font-black">
                    <td className="border border-slate-950 bg-pink-400 px-3 py-2">TOTAL COMISIONES</td>
                    {weeks.map((week) => {
                      const values = getWeekValues(row, week);
                      return <td key={week.startDate} className="border border-slate-950 px-3 py-2 text-lg">{values.semanaFutura ? "-" : formatCommission(values.totalComisiones)}</td>;
                    })}
                    <td className="border border-slate-950 bg-amber-100 px-3 py-2 text-lg">{formatCommission(mensual.valorComisionSemanal)}</td>
                    <td className="border border-slate-950 px-3 py-2 text-lg">{formatCommission(mensual.valorComisionMensual)}</td>
                    <td className="border border-slate-950 bg-red-600 px-3 py-2 text-lg text-white">{formatCommission(Number(mensual.valorComisionSemanal || 0) + Number(mensual.valorComisionMensual || 0))}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </div>
  );
}

function Metric({ icon = null, label, value }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 text-xs font-medium uppercase text-slate-500">
        {icon}
        {label}
      </div>
      <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
    </div>
  );
}

function CollaboratorSearchInput({
  label = "Colaborador",
  options,
  searchValue,
  selectedId,
  open,
  placeholder,
  onOpenChange,
  onSearchChange,
  onShowAll,
  onSelect,
}) {
  return (
    <div
      className="relative text-sm font-medium text-slate-700"
      onBlur={() => window.setTimeout(() => onOpenChange(false), 120)}
    >
      {label}
      <div className="mt-1 flex overflow-hidden rounded-lg border border-slate-300 bg-white focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-100">
        <input
          type="text"
          value={searchValue}
          onChange={(event) => onSearchChange(event.target.value)}
          onFocus={() => onOpenChange(true)}
          placeholder={placeholder}
          className="min-w-0 flex-1 px-3 py-2 text-sm font-normal text-slate-900 outline-none"
        />
        <button
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={onShowAll}
          title="Ver colaboradores"
          aria-label="Ver colaboradores"
          className="inline-flex w-11 items-center justify-center border-l border-slate-300 text-slate-600 transition hover:bg-slate-50 hover:text-emerald-700"
        >
          <Search size={17} />
        </button>
      </div>
      {open ? (
        <div className="absolute left-0 right-0 z-30 mt-1 max-h-72 overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
          {options.length ? (
            options.map((vendedor) => {
              const id = String(vendedor.usuarioId);
              const cargo =
                vendedor.cargoComision || vendedor.cargo || vendedor.rol || "";
              return (
                <button
                  type="button"
                  key={id}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => onSelect(vendedor)}
                  className={`flex w-full flex-col px-3 py-2 text-left text-sm transition hover:bg-emerald-50 ${
                    selectedId === id ? "bg-emerald-100 text-emerald-900" : "text-slate-800"
                  }`}
                >
                  <span className="font-semibold">{vendedor.nombre}</span>
                  {cargo ? (
                    <span className="text-[11px] font-normal text-slate-500">
                      {cargo}
                    </span>
                  ) : null}
                </button>
              );
            })
          ) : (
            <div className="px-3 py-2 text-sm font-normal text-slate-500">
              Sin coincidencias
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function WeekHeader({ color }) {
  return (
    <>
      <th className={`border border-slate-950 px-2 py-2 text-xs font-black ${color}`}>
        DISPOSITIVOS VENDIDOS
      </th>
      <th className={`border border-slate-950 px-2 py-2 text-xs font-black ${color}`}>
        MONTO VENDIDO
      </th>
      <th className={`border border-slate-950 px-2 py-2 text-xs font-black ${color}`}>
        TOTAL COMISIONES
      </th>
      {SHOW_GOAL_COMPLIANCE_SECTION ? (
        <th className="border border-slate-950 bg-blue-800 px-2 py-2 text-xs font-black text-white">
          NO CUMPLE METAS
        </th>
      ) : null}
    </>
  );
}

function WeekValues({
  values,
  total = false,
  vendedor = null,
  week = null,
  descuentoEditado = null,
  onCambiarDescuento = null,
  onRestaurarDescuento = null,
  guardando = false,
  periodoPagado = false,
}) {
  const noCumpleClass = total
    ? "border border-slate-950 px-2 py-1.5"
    : "border border-slate-950 bg-indigo-100 px-2 py-1.5";
  const descuentoTextClass = total ? "text-white" : "text-red-700";
  const puedeGestionarMulta =
    !total &&
    vendedor &&
    week &&
    onCambiarDescuento &&
    !periodoPagado &&
    Number(values.valorMultaCalculado || 0) > 0;
  const valorInput = descuentoEditado
    ? descuentoEditado.valorDescontar
    : Number(values.valorDescontar || 0).toFixed(2);
  const valorInputValido = parseValorDescuentoInput(valorInput) !== null;

  return (
    <>
      <td className="border border-slate-950 px-2 py-1.5">
        {values.semanaFutura ? "Pendiente" : values.venden || ""}
      </td>
      <td className="border border-slate-950 px-2 py-1.5">
        {values.semanaFutura ? "-" : values.valorVendido ? formatMoney(values.valorVendido) : ""}
      </td>
      <td className="border border-slate-950 px-2 py-1.5">
        {values.semanaFutura ? "-" : values.totalComisiones ? formatCommission(values.totalComisiones) : 0}
      </td>
      {SHOW_GOAL_COMPLIANCE_SECTION ? (
        <td className={noCumpleClass}>
          {values.semanaFutura
            ? "-"
            : !total && values.semanaLaborada === false
              ? "No laborada"
              : !total && values.semanaCompletaParaDescuento === false
                ? "Semana parcial"
                : (
                  <div className="flex min-w-[128px] flex-col items-center gap-1">
                    <span className="font-semibold">{values.noCumpleMetas || 0}</span>
                    {puedeGestionarMulta ? (
                      <>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={valorInput}
                          disabled={guardando}
                          maxLength={13}
                          pattern="\d+(\.\d{0,2})?"
                          placeholder="0.00"
                          onChange={(event) => {
                            const value = event.target.value;
                            if (!esFormatoValorDescuentoInputValido(value)) return;
                            onCambiarDescuento({
                              vendedor,
                              week,
                              values,
                              value,
                            });
                          }}
                          aria-label={`Valor a descontar de ${vendedor.nombre} en ${week.label}`}
                          className={`w-24 rounded border bg-white px-2 py-1 text-center text-xs font-semibold outline-none focus:ring-2 disabled:opacity-60 ${
                            !valorInputValido
                              ? "border-red-600 text-red-700 focus:ring-red-200"
                              : descuentoEditado
                                ? "border-amber-500 text-amber-800 focus:ring-amber-200"
                                : "border-slate-300 text-red-700 focus:ring-red-200"
                          }`}
                        />
                        <span className="text-[10px] text-slate-500">
                          Sancion: {formatMoney(values.valorMultaCalculado)}
                        </span>
                        {descuentoEditado ? (
                          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-800">
                            Pendiente de guardar
                          </span>
                        ) : null}
                        {(values.descuentoModificado || descuentoEditado) && onRestaurarDescuento ? (
                          <button
                            type="button"
                            disabled={guardando}
                            onClick={() =>
                              onRestaurarDescuento({
                                vendedor,
                                week,
                                values,
                              })
                            }
                            className="text-[10px] font-semibold text-emerald-700 underline hover:text-emerald-800 disabled:opacity-60"
                          >
                            Usar sancion
                          </button>
                        ) : null}
                      </>
                    ) : (
                      <span className={`text-[11px] font-semibold ${descuentoTextClass}`}>
                        Desc: {formatMoney(values.valorDescontar || 0)}
                      </span>
                    )}
                  </div>
                )}
        </td>
      ) : null}
    </>
  );
}

function MonthlyHeader() {
  return (
    <>
      <th
        rowSpan={2}
        className="border border-slate-950 bg-red-600 px-2 py-2 text-xs font-black text-white"
      >
        Ventas Mensuales
      </th>
      <th
        rowSpan={2}
        className="border border-slate-950 bg-red-600 px-2 py-2 text-xs font-black text-white"
      >
        Valor Comision Semanal
      </th>
      <th
        rowSpan={2}
        className="border border-slate-950 bg-red-600 px-2 py-2 text-xs font-black text-white"
      >
        Valor Comision Mensual
      </th>
      <th
        rowSpan={2}
        className="border border-slate-950 bg-red-600 px-2 py-2 text-xs font-black text-white"
      >
        Total Comisiones Semana + Mensual
      </th>
      {SHOW_GOAL_COMPLIANCE_SECTION ? (
        <th
          rowSpan={2}
          className="border border-slate-950 bg-red-700 px-2 py-2 text-xs font-black text-white"
        >
          Total No Cumple Metas
        </th>
      ) : null}
    </>
  );
}

function MonthlyValues({ values, total = false }) {
  const totalClass = total
    ? "border border-slate-950 bg-red-600 px-2 py-1.5 text-white"
    : "border border-slate-950 px-2 py-1.5 text-red-600";

  return (
    <>
      <td className={totalClass}>{values.ventasTvCelulaMensual || 0}</td>
      <td className={totalClass}>
        {values.valorComisionSemanal
          ? formatCommission(values.valorComisionSemanal)
          : 0}
      </td>
      <td className={totalClass}>
        {values.valorComisionMensual
          ? formatCommission(values.valorComisionMensual)
          : ""}
      </td>
      <td className={totalClass}>
        {values.totalComisionesSemanaMensual
          ? formatCommission(values.totalComisionesSemanaMensual)
          : "0.00"}
      </td>
      {SHOW_GOAL_COMPLIANCE_SECTION ? (
        <td className="border border-slate-950 bg-blue-700 px-2 py-1.5 text-white">
          {formatMoney(values.totalValorDescontar || 0)}
        </td>
      ) : null}
    </>
  );
}
