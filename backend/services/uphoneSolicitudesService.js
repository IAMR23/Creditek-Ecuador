const ExcelJS = require("exceljs");
const { Op } = require("sequelize");

const UphoneSolicitud = require("../models/UphoneSolicitud");

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_ROWS_PER_FILE = 25000;
const MAX_PAGE_SIZE = 100;
const INSERT_CHUNK_SIZE = 500;

const COLUMNAS = [
  { key: "distribuidor", label: "DISTRIBUIDOR" },
  { key: "matriz", label: "MATRIZ" },
  { key: "vendedor", label: "VENDEDOR" },
  {
    key: "numeroSolicitud",
    label: "NUMERO DE SOLICITUD",
    aliases: ["NUMERO DE SOLICTUD"],
  },
  { key: "usuario", label: "USUARIO" },
  { key: "cedula", label: "CEDULA" },
  { key: "cliente", label: "CLIENTE" },
  { key: "telefonoSolicitud", label: "TELEFONO SOLICITUD" },
  { key: "telefonoContrato", label: "TELEFONO CONTRATO" },
  { key: "fechaSolicitud", label: "FECHA SOLICITUD" },
  { key: "fechaContrato", label: "FECHA CONTRATO" },
  { key: "grupoArrendamiento", label: "GRUPO ARRENDAMIENTO" },
  { key: "estado", label: "ESTADO" },
  { key: "estadoContrato", label: "ESTADO CONTRATO" },
];

const crearError = (message, statusCode = 400, code) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  if (code) error.code = code;
  return error;
};

const normalizarEncabezado = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();

const valorCelda = (cell) => {
  const value = cell?.value;
  if (value && typeof value === "object" && !(value instanceof Date)) {
    if (Object.hasOwn(value, "result")) return value.result;
    if (Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text || "").join("");
    }
    if (Object.hasOwn(value, "text")) return value.text;
  }
  return value;
};

const normalizarTexto = (value, maxLength) => {
  if (value === undefined || value === null) return null;
  const text = String(value).replaceAll("\u0000", "").trim();
  return text ? text.slice(0, maxLength) : null;
};

const normalizarNumeroSolicitud = (value) => {
  if (typeof value === "number") {
    return Number.isFinite(value) && Number.isInteger(value)
      ? String(value)
      : null;
  }
  const text = normalizarTexto(value, 40);
  if (!text) return null;
  return /^\d+\.0+$/.test(text) ? text.replace(/\.0+$/, "") : text;
};

const normalizarFechaSolicitud = (value) => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    // Excel no guarda zona horaria. ExcelJS entrega sus componentes como UTC;
    // se reinterpretan como hora local de Ecuador para no restar cinco horas
    // al mostrar el reporte.
    const pad = (part) => String(part).padStart(2, "0");
    return new Date(
      `${value.getUTCFullYear()}-${pad(value.getUTCMonth() + 1)}-${pad(value.getUTCDate())}`
      + `T${pad(value.getUTCHours())}:${pad(value.getUTCMinutes())}:${pad(value.getUTCSeconds())}-05:00`,
    );
  }

  const text = normalizarTexto(value, 40);
  if (!text) return null;

  let match = text.match(
    /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/,
  );
  if (!match) {
    const latin = text.match(
      /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/,
    );
    if (latin) {
      match = [latin[0], latin[3], latin[2], latin[1], latin[4], latin[5], latin[6]];
    }
  }
  if (!match) return null;

  const [, year, month, day, hour = "0", minute = "0", second = "0"] = match;
  const isoDate = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const validationDate = new Date(`${isoDate}T00:00:00.000Z`);
  if (
    Number.isNaN(validationDate.getTime()) ||
    validationDate.toISOString().slice(0, 10) !== isoDate
  ) {
    return null;
  }

  const parsed = new Date(
    `${isoDate}T${String(hour).padStart(2, "0")}:${minute}:${second}-05:00`,
  );
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const obtenerMapaColumnas = (row) => {
  const encabezados = new Map();
  row.eachCell({ includeEmpty: true }, (cell, columnNumber) => {
    const header = normalizarEncabezado(valorCelda(cell));
    if (header) encabezados.set(header, columnNumber);
  });

  const columns = {};
  for (const definition of COLUMNAS) {
    const aliases = [definition.label, ...(definition.aliases || [])].map(
      normalizarEncabezado,
    );
    const alias = aliases.find((candidate) => encabezados.has(candidate));
    if (alias) columns[definition.key] = encabezados.get(alias);
  }
  return columns;
};

const buscarEncabezados = (workbook) => {
  for (const worksheet of workbook.worksheets) {
    const rowsToInspect = Math.min(15, worksheet.actualRowCount || 0);
    for (let rowNumber = 1; rowNumber <= rowsToInspect; rowNumber += 1) {
      const columns = obtenerMapaColumnas(worksheet.getRow(rowNumber));
      if (columns.numeroSolicitud) return { worksheet, rowNumber, columns };
    }
  }
  return null;
};

const parsearExcel = async (buffer) => {
  if (!Buffer.isBuffer(buffer) || !buffer.length) {
    throw crearError("Debes adjuntar un archivo Excel no vacio", 400, "ARCHIVO_REQUERIDO");
  }

  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer);
  } catch {
    throw crearError("El archivo no es un Excel .xlsx valido", 400, "EXCEL_INVALIDO");
  }

  const header = buscarEncabezados(workbook);
  if (!header) {
    throw crearError(
      "No se encontro la fila de encabezados del reporte Uphone",
      400,
      "ENCABEZADOS_NO_ENCONTRADOS",
    );
  }

  const missing = COLUMNAS.filter(({ key }) => !header.columns[key]).map(
    ({ label }) => label,
  );
  if (missing.length) {
    throw crearError(
      `Faltan columnas requeridas: ${missing.join(", ")}`,
      400,
      "COLUMNAS_FALTANTES",
    );
  }

  const dataRowCount = Math.max(0, header.worksheet.actualRowCount - header.rowNumber);
  if (dataRowCount > MAX_ROWS_PER_FILE) {
    throw crearError(
      `El archivo supera el limite de ${MAX_ROWS_PER_FILE} filas`,
      400,
      "DEMASIADAS_FILAS",
    );
  }

  const records = [];
  const invalidRows = [];
  let emptyRows = 0;

  for (
    let rowNumber = header.rowNumber + 1;
    rowNumber <= header.worksheet.actualRowCount;
    rowNumber += 1
  ) {
    const row = header.worksheet.getRow(rowNumber);
    const get = (key) => valorCelda(row.getCell(header.columns[key]));
    const rawValues = COLUMNAS.map(({ key }) => get(key));
    const hasData = rawValues.some((value) => normalizarTexto(value, 10));
    if (!hasData) {
      emptyRows += 1;
      continue;
    }

    const numeroSolicitud = normalizarNumeroSolicitud(get("numeroSolicitud"));
    if (!numeroSolicitud) {
      invalidRows.push({ fila: rowNumber, motivo: "Numero de solicitud vacio o invalido" });
      continue;
    }

    records.push({
      filaExcel: rowNumber,
      numeroSolicitud,
      distribuidor: normalizarTexto(get("distribuidor"), 180),
      matriz: normalizarTexto(get("matriz"), 180),
      vendedor: normalizarTexto(get("vendedor"), 220),
      usuario: normalizarTexto(get("usuario"), 100),
      cedula: normalizarTexto(get("cedula"), 30),
      cliente: normalizarTexto(get("cliente"), 220),
      telefonoSolicitud: normalizarTexto(get("telefonoSolicitud"), 30),
      telefonoContrato: normalizarTexto(get("telefonoContrato"), 30),
      fechaSolicitud: normalizarFechaSolicitud(get("fechaSolicitud")),
      fechaContrato: normalizarTexto(get("fechaContrato"), 40),
      grupoArrendamiento: normalizarTexto(get("grupoArrendamiento"), 160),
      estado: normalizarTexto(get("estado"), 80),
      estadoContrato: normalizarTexto(get("estadoContrato"), 120),
    });
  }

  return {
    records,
    invalidRows,
    emptyRows,
    sheetName: header.worksheet.name,
  };
};

const importarExcel = async ({ file, usuarioId, requestId }) => {
  if (!file?.buffer) {
    throw crearError("Debes adjuntar el Excel en el campo archivo", 400, "ARCHIVO_REQUERIDO");
  }

  let parsed;
  try {
    parsed = await parsearExcel(file.buffer);
  } catch (error) {
    error.uphoneStage = "analizar_excel";
    throw error;
  }
  const uniqueByNumber = new Map();
  for (const record of parsed.records) {
    if (!uniqueByNumber.has(record.numeroSolicitud)) {
      uniqueByNumber.set(record.numeroSolicitud, record);
    }
  }

  const candidates = [...uniqueByNumber.values()].map(({ filaExcel, ...record }) => ({
    ...record,
    archivoOrigen: normalizarTexto(file.originalname, 255) || "reporte-uphone.xlsx",
    importadoPorId: usuarioId || null,
  }));

  const inserted = [];
  for (let index = 0; index < candidates.length; index += INSERT_CHUNK_SIZE) {
    const chunk = candidates.slice(index, index + INSERT_CHUNK_SIZE);
    let created;
    try {
      created = await UphoneSolicitud.bulkCreate(chunk, {
        ignoreDuplicates: true,
        returning: ["id", "numeroSolicitud"],
      });
    } catch (error) {
      error.uphoneStage = "insertar_postgresql";
      error.uphoneChunk = {
        index: Math.floor(index / INSERT_CHUNK_SIZE) + 1,
        rows: chunk.length,
        requestId,
      };
      throw error;
    }
    inserted.push(...created.filter((item) => item?.id));
  }

  return {
    archivo: normalizarTexto(file.originalname, 255),
    hoja: parsed.sheetName,
    filasLeidas: parsed.records.length + parsed.invalidRows.length,
    solicitudesValidas: parsed.records.length,
    insertadas: inserted.length,
    omitidasDuplicadas: parsed.records.length - inserted.length,
    omitidasInvalidas: parsed.invalidRows.length,
    omitidasVacias: parsed.emptyRows,
    errores: parsed.invalidRows.slice(0, 20),
  };
};

const normalizarEntero = (value, fallback, min, max) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
};

const parseDateBoundary = (value, endOfDay = false) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return null;
  const suffix = endOfDay ? "T23:59:59.999-05:00" : "T00:00:00.000-05:00";
  const date = new Date(`${value}${suffix}`);
  return Number.isNaN(date.getTime()) ? null : date;
};

const listar = async (query = {}) => {
  const page = normalizarEntero(query.page, 1, 1, Number.MAX_SAFE_INTEGER);
  const pageSize = normalizarEntero(query.pageSize, 25, 1, MAX_PAGE_SIZE);
  const where = {};
  const q = normalizarTexto(query.q, 120);
  const estado = normalizarTexto(query.estado, 80);
  const desde = parseDateBoundary(query.fechaDesde);
  const hasta = parseDateBoundary(query.fechaHasta, true);

  if (q) {
    where[Op.or] = [
      "numeroSolicitud",
      "distribuidor",
      "matriz",
      "vendedor",
      "usuario",
      "cedula",
      "cliente",
    ].map((field) => ({ [field]: { [Op.iLike]: `%${q}%` } }));
  }
  if (estado) where.estado = { [Op.iLike]: estado };
  if (desde || hasta) {
    where.fechaSolicitud = {
      ...(desde ? { [Op.gte]: desde } : {}),
      ...(hasta ? { [Op.lte]: hasta } : {}),
    };
  }

  const [result, totalRegistradas] = await Promise.all([
    UphoneSolicitud.findAndCountAll({
      where,
      limit: pageSize,
      offset: (page - 1) * pageSize,
      order: [
        ["fechaSolicitud", "DESC NULLS LAST"],
        ["id", "DESC"],
      ],
    }),
    UphoneSolicitud.count(),
  ]);

  const totalPages = Math.max(1, Math.ceil(result.count / pageSize));
  return {
    ok: true,
    solicitudes: result.rows,
    resumen: {
      totalRegistradas,
      totalFiltradas: result.count,
    },
    paginacion: {
      page,
      pageSize,
      total: result.count,
      totalPages,
    },
  };
};

module.exports = {
  MAX_FILE_SIZE_BYTES,
  MAX_ROWS_PER_FILE,
  importarExcel,
  listar,
  parsearExcel,
};
