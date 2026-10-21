const crypto = require("crypto");
const fs = require("fs/promises");
const path = require("path");
const { TextDecoder } = require("util");
const { Op } = require("sequelize");
const ExcelJS = require("exceljs");

const { sequelize } = require("../config/db");
const FacturaRegistro = require("../models/FacturaRegistro");

const MAX_JSON_BYTES = 5 * 1024 * 1024;
const MAX_FACTURA_IMAGE_BYTES = 600 * 1024;
const MAX_FACTURAS_POR_ARCHIVO = 1000;
const MAX_LIMIT = 100;
const CAMPOS_MONETARIOS = ["subtotal", "iva", "total"];
const FACTURAS_UPLOAD_DIR = path.resolve(__dirname, "..", "uploads", "facturas");
const FACTURA_IMAGE_EXTENSIONS = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

const crearError = (message, statusCode = 400, extra = {}) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  Object.assign(error, extra);
  return error;
};

const normalizarClave = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();

const indexarObjeto = (value) =>
  Object.entries(value || {}).reduce((result, [key, item]) => {
    result[normalizarClave(key)] = item;
    return result;
  }, {});

const primerValor = (index, aliases) => {
  for (const alias of aliases) {
    const value = index[normalizarClave(alias)];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return null;
};

const normalizarTexto = (value, maxLength) => {
  if (value === undefined || value === null) return null;
  const text = String(value).replaceAll("\u0000", "").trim();
  return text ? text.slice(0, maxLength) : null;
};

const normalizarNumeroFactura = (value) =>
  normalizarTexto(value, 100)?.replace(/\s+/g, "").toUpperCase() || null;

const normalizarId = (value) => {
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1) throw crearError("La factura no es valida");
  return id;
};

const normalizarFecha = (value) => {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10);
  }
  const text = normalizarTexto(value, 40);
  if (!text) return null;

  let parts = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (!parts) {
    const latin = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
    if (latin) parts = [latin[0], latin[3], latin[2], latin[1]];
  }
  if (!parts) return null;

  const iso = `${parts[1]}-${parts[2].padStart(2, "0")}-${parts[3].padStart(2, "0")}`;
  const date = new Date(`${iso}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === iso
    ? iso
    : null;
};

const normalizarMonto = (value) => {
  if (typeof value === "number") {
    return Number.isFinite(value) && value >= 0 ? Number(value.toFixed(2)) : null;
  }
  let text = normalizarTexto(value, 60)?.replace(/[^0-9,.-]/g, "");
  if (!text || text.includes("-")) return null;

  const comma = text.lastIndexOf(",");
  const dot = text.lastIndexOf(".");
  if (comma >= 0 && dot >= 0) {
    const decimal = comma > dot ? "," : ".";
    text = text.replaceAll(decimal === "," ? "." : ",", "").replace(decimal, ".");
  } else if (comma >= 0) {
    text = text.replaceAll(".", "").replace(",", ".");
  } else if ((text.match(/\./g) || []).length > 1) {
    const pieces = text.split(".");
    const decimals = pieces.pop();
    text = `${pieces.join("")}.${decimals}`;
  }

  const number = Number(text);
  return Number.isFinite(number) && number >= 0 && number <= 999999999999.99
    ? Number(number.toFixed(2))
    : null;
};

const normalizarEnlace = (value) => {
  const text = normalizarTexto(value, 2048);
  if (!text) return null;
  try {
    const url = new URL(text);
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
};

const normalizarFactura = (payload, index = 0) => {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw crearError(`Factura ${index + 1}: cada registro debe ser un objeto`);
  }

  const values = indexarObjeto(payload);
  const enlaceOriginal = primerValor(values, [
    "enlaceFoto",
    "enlace a la foto",
    "foto",
    "urlFoto",
    "linkFoto",
  ]);
  const factura = {
    fechaFactura: normalizarFecha(
      primerValor(values, ["fechaFactura", "fecha de factura", "fecha", "fechaEmision"]),
    ),
    proveedor: normalizarTexto(
      primerValor(values, ["proveedor", "nombreProveedor", "razonSocial"]),
      255,
    ),
    identificacionProveedor: normalizarTexto(
      primerValor(values, [
        "rucCedula",
        "RUC / Cedula",
        "ruc",
        "cedula",
        "identificacionProveedor",
        "identificacion",
      ]),
      30,
    ),
    numeroFactura: normalizarNumeroFactura(
      primerValor(values, ["numeroFactura", "N. de factura", "N.º de factura", "factura"]),
    ),
    subtotal: normalizarMonto(primerValor(values, ["subtotal"])),
    iva: normalizarMonto(primerValor(values, ["iva", "impuesto", "impuestos"])),
    total: normalizarMonto(primerValor(values, ["total"])),
    formaPago: normalizarTexto(
      primerValor(values, ["formaPago", "forma de pago", "metodoPago"]),
      120,
    ),
    estado: normalizarTexto(primerValor(values, ["estado"]), 80),
    enlaceFoto: normalizarEnlace(enlaceOriginal),
    observaciones: normalizarTexto(
      primerValor(values, ["observaciones", "observacion", "notas"]),
      5000,
    ),
    tipo: normalizarTexto(primerValor(values, ["tipo", "TIPO"]), 100),
  };

  const advertencias = [];
  if (enlaceOriginal && !factura.enlaceFoto) {
    advertencias.push("Enlace a la foto no es una URL http o https valida");
  }
  if (
    factura.subtotal !== null &&
    factura.iva !== null &&
    factura.total !== null &&
    Math.abs(factura.subtotal + factura.iva - factura.total) > 0.02
  ) {
    advertencias.push("Subtotal mas IVA no coincide con el total");
  }
  if (advertencias.length) {
    const advertencia = `Advertencia: ${advertencias.join("; ")}`;
    factura.observaciones = normalizarTexto(
      [advertencia, factura.observaciones]
        .filter(Boolean)
        .filter((value, position, values) => values.indexOf(value) === position)
        .join(" | "),
      5000,
    );
  }
  return factura;
};

const extraerFacturas = (payload) => {
  const values = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.facturas)
      ? payload.facturas
      : [payload];
  if (!values.length) throw crearError("El JSON no contiene facturas");
  if (values.length > MAX_FACTURAS_POR_ARCHIVO) {
    throw crearError(
      `Cada archivo puede contener maximo ${MAX_FACTURAS_POR_ARCHIVO} facturas`,
    );
  }
  return values;
};

const validarArchivo = (file) => {
  if (!file || !Buffer.isBuffer(file.buffer)) {
    throw crearError("Selecciona un archivo JSON");
  }
  if (!file.size) throw crearError("El archivo JSON esta vacio");
  if (file.size > MAX_JSON_BYTES) {
    throw crearError("El archivo JSON supera el limite de 5 MB");
  }
  if (path.extname(file.originalname || "").toLowerCase() !== ".json") {
    throw crearError("Solo se permiten archivos con extension .json");
  }
};

const validarArchivoExcel = (file) => {
  if (!file || !Buffer.isBuffer(file.buffer)) {
    throw crearError("Selecciona un archivo Excel");
  }
  if (!file.size) throw crearError("El archivo Excel esta vacio");
  if (file.size > MAX_JSON_BYTES) {
    throw crearError("El archivo Excel supera el limite de 5 MB");
  }
  if (path.extname(file.originalname || "").toLowerCase() !== ".xlsx") {
    throw crearError("Solo se permiten archivos Excel con extension .xlsx");
  }
};

const parsearJson = (buffer) => {
  let text;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    throw crearError("El archivo debe estar codificado en UTF-8");
  }
  try {
    return JSON.parse(text.replace(/^\uFEFF/, ""));
  } catch {
    throw crearError("El archivo no contiene un JSON valido");
  }
};

const firmaImagenValida = (buffer, mimeType) => {
  if (!Buffer.isBuffer(buffer)) return false;
  if (mimeType === "image/jpeg") {
    return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (mimeType === "image/png") {
    return (
      buffer.length >= 8 &&
      buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    );
  }
  if (mimeType === "image/webp") {
    return (
      buffer.length >= 12 &&
      buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
      buffer.subarray(8, 12).toString("ascii") === "WEBP"
    );
  }
  return false;
};

const validarFotoFactura = (file) => {
  if (!file || !Buffer.isBuffer(file.buffer) || !file.size) {
    throw crearError("Selecciona una foto de la factura o nota de venta");
  }
  if (file.size > MAX_FACTURA_IMAGE_BYTES) {
    throw crearError("La imagen procesada no puede superar los 600 KB");
  }
  const extension = FACTURA_IMAGE_EXTENSIONS[file.mimetype];
  if (!extension || !firmaImagenValida(file.buffer, file.mimetype)) {
    throw crearError("La imagen debe ser JPG, PNG o WEBP valida");
  }
  return extension;
};

const serializar = (value) => {
  const result = typeof value?.toJSON === "function" ? value.toJSON() : { ...value };
  for (const field of CAMPOS_MONETARIOS) {
    result[field] = [null, undefined, ""].includes(result[field])
      ? null
      : Number(result[field]);
  }
  return { ...result, fechaCarga: result.createdAt };
};

const validarNumerosFacturaDisponibles = async (facturas) => {
  const numbers = facturas
    .map((factura) => factura.numeroFactura)
    .filter(Boolean);
  const duplicatesInFile = [
    ...new Set(numbers.filter((number, index) => numbers.indexOf(number) !== index)),
  ];
  if (duplicatesInFile.length) {
    throw crearError(
      `El JSON contiene numeros de factura repetidos: ${duplicatesInFile.join(", ")}`,
      409,
      { duplicados: duplicatesInFile },
    );
  }

  if (!numbers.length) return;

  const existing = await FacturaRegistro.findAll({
    where: { numeroFactura: { [Op.in]: numbers } },
    attributes: ["numeroFactura"],
    raw: true,
  });
  const existingNumbers = [...new Set(existing.map((row) => row.numeroFactura))];
  if (existingNumbers.length) {
    throw crearError(
      `No se realizó la carga. El número de factura ya existe: ${existingNumbers.join(", ")}`,
      409,
      { duplicados: existingNumbers },
    );
  }
};

const guardarPayload = async ({ payload, nombreArchivoJson }) => {
  const invoices = extraerFacturas(payload);
  const normalized = invoices.map((invoice, index) => normalizarFactura(invoice, index));
  await validarNumerosFacturaDisponibles(normalized);
  const filename = path.basename(nombreArchivoJson || "facturas.json").slice(0, 255);

  let created;
  try {
    created = await sequelize.transaction(async (transaction) =>
      FacturaRegistro.bulkCreate(
        normalized.map((invoice, index) => ({
          ...invoice,
          nombreArchivoJson: filename,
          payloadOriginal: invoices[index],
        })),
        { transaction, validate: true, returning: true },
      ),
    );
  } catch (error) {
    if (error.name === "SequelizeUniqueConstraintError") {
      throw crearError(
        "No se realizó la carga porque uno de los números de factura ya existe.",
        409,
      );
    }
    throw error;
  }
  return created.map(serializar);
};

const cargarJson = async ({ file }) => {
  validarArchivo(file);
  return guardarPayload({
    payload: parsearJson(file.buffer),
    nombreArchivoJson: file.originalname || "facturas.json",
  });
};

const cargarJsonTexto = async ({ contenido }) => {
  if (typeof contenido !== "string" || !contenido.trim()) {
    throw crearError("Pega el contenido JSON que deseas procesar");
  }
  if (Buffer.byteLength(contenido, "utf8") > MAX_JSON_BYTES) {
    throw crearError("El contenido JSON supera el limite de 5 MB");
  }

  let payload;
  try {
    payload = JSON.parse(contenido.replace(/^\uFEFF/, ""));
  } catch {
    throw crearError("El contenido pegado no es un JSON valido");
  }

  return guardarPayload({
    payload,
    nombreArchivoJson: "contenido-pegado.json",
  });
};

const obtenerValorCeldaExcel = (cell) => {
  const value = cell?.value;
  if (!value || typeof value !== "object" || value instanceof Date) return value;
  if (value.hyperlink) return value.hyperlink;
  if (value.result !== undefined) return value.result;
  if (Array.isArray(value.richText)) {
    return value.richText.map((item) => item.text || "").join("");
  }
  return value.text ?? value;
};

const parsearExcel = async (buffer) => {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer);
  } catch {
    throw crearError("El archivo no contiene un Excel .xlsx valido");
  }

  const worksheet = workbook.worksheets.find((sheet) => sheet.actualRowCount > 0);
  if (!worksheet) throw crearError("El archivo Excel no contiene filas");

  let headerRowNumber = null;
  let headers = [];
  worksheet.eachRow((row, rowNumber) => {
    if (headerRowNumber !== null) return;
    const values = Array.from({ length: row.cellCount }, (_, index) =>
      normalizarTexto(obtenerValorCeldaExcel(row.getCell(index + 1)), 255),
    );
    if (values.some(Boolean)) {
      headerRowNumber = rowNumber;
      headers = values;
    }
  });

  if (headerRowNumber === null || !headers.some(Boolean)) {
    throw crearError("No se encontraron encabezados en el archivo Excel");
  }

  const invoices = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber <= headerRowNumber) return;
    const invoice = {};
    let hasValues = false;
    headers.forEach((header, index) => {
      if (!header) return;
      const value = obtenerValorCeldaExcel(row.getCell(index + 1));
      if (value !== null && value !== undefined && value !== "") hasValues = true;
      invoice[header] = value;
    });
    if (hasValues) invoices.push(invoice);
  });

  if (!invoices.length) throw crearError("El archivo Excel no contiene facturas");
  if (invoices.length > MAX_FACTURAS_POR_ARCHIVO) {
    throw crearError(
      `Cada archivo puede contener maximo ${MAX_FACTURAS_POR_ARCHIVO} facturas`,
    );
  }
  return invoices;
};

const cargarExcel = async ({ file }) => {
  validarArchivoExcel(file);
  return guardarPayload({
    payload: await parsearExcel(file.buffer),
    nombreArchivoJson: file.originalname || "facturas.xlsx",
  });
};

const eliminarFotoLocal = async (enlaceFoto) => {
  if (!String(enlaceFoto || "").startsWith("/uploads/facturas/")) return;
  const filePath = path.resolve(FACTURAS_UPLOAD_DIR, path.basename(enlaceFoto));
  if (path.dirname(filePath) !== FACTURAS_UPLOAD_DIR) return;
  try {
    await fs.unlink(filePath);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
};

const guardarFotoFactura = async ({ id, file }) => {
  const facturaId = normalizarId(id);
  const extension = validarFotoFactura(file);
  const factura = await FacturaRegistro.findByPk(facturaId);
  if (!factura) throw crearError("Factura no encontrada", 404);

  await fs.mkdir(FACTURAS_UPLOAD_DIR, { recursive: true });
  const filename = `${crypto.randomUUID()}${extension}`;
  const filePath = path.join(FACTURAS_UPLOAD_DIR, filename);
  const enlaceFoto = `/uploads/facturas/${filename}`;
  const enlaceAnterior = factura.enlaceFoto;

  try {
    await fs.writeFile(filePath, file.buffer, { flag: "wx" });
    await factura.update({ enlaceFoto });
  } catch (error) {
    await fs.unlink(filePath).catch(() => undefined);
    throw error;
  }

  await eliminarFotoLocal(enlaceAnterior);
  return serializar(factura);
};

const normalizarDatosEdicion = (payload) => {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw crearError("Los datos de la factura no son validos");
  }

  const datos = {};
  const tieneCampo = (campo) => Object.prototype.hasOwnProperty.call(payload, campo);

  if (tieneCampo("fechaFactura")) {
    datos.fechaFactura = normalizarFecha(payload.fechaFactura);
    if (payload.fechaFactura && !datos.fechaFactura) {
      throw crearError("La fecha de la factura no es valida");
    }
  }

  for (const [campo, maxLength, normalizador] of [
    ["proveedor", 255, normalizarTexto],
    ["identificacionProveedor", 30, normalizarTexto],
    ["numeroFactura", 100, normalizarNumeroFactura],
    ["formaPago", 120, normalizarTexto],
    ["estado", 80, normalizarTexto],
    ["observaciones", 5000, normalizarTexto],
    ["tipo", 100, normalizarTexto],
  ]) {
    if (tieneCampo(campo)) datos[campo] = normalizador(payload[campo], maxLength);
  }

  for (const campo of CAMPOS_MONETARIOS) {
    if (!tieneCampo(campo)) continue;
    datos[campo] = normalizarMonto(payload[campo]);
    if (payload[campo] !== "" && payload[campo] !== null && payload[campo] !== undefined && datos[campo] === null) {
      throw crearError(`${campo} debe ser un valor numerico mayor o igual a cero`);
    }
  }

  if (!Object.keys(datos).length) {
    throw crearError("No se enviaron campos editables");
  }
  return datos;
};

const actualizarFactura = async ({ id, payload }) => {
  const facturaId = normalizarId(id);
  const datos = normalizarDatosEdicion(payload);
  const factura = await FacturaRegistro.findByPk(facturaId);
  if (!factura) throw crearError("Factura no encontrada", 404);

  if (datos.numeroFactura && datos.numeroFactura !== factura.numeroFactura) {
    const existente = await FacturaRegistro.findOne({
      where: {
        numeroFactura: datos.numeroFactura,
        id: { [Op.ne]: facturaId },
      },
      attributes: ["id"],
    });
    if (existente) {
      throw crearError("El numero de factura ya existe", 409, {
        duplicados: [datos.numeroFactura],
      });
    }
  }

  try {
    await factura.update(datos);
  } catch (error) {
    if (error.name === "SequelizeUniqueConstraintError") {
      throw crearError("El numero de factura ya existe", 409, {
        duplicados: datos.numeroFactura ? [datos.numeroFactura] : [],
      });
    }
    throw error;
  }
  return serializar(factura);
};

const normalizarFiltros = (query = {}) => {
  const where = {};
  const search = normalizarTexto(query.busqueda, 120);
  if (search) {
    where[Op.or] = [
      "proveedor",
      "identificacionProveedor",
      "numeroFactura",
      "formaPago",
      "estado",
      "tipo",
      "observaciones",
    ].map((field) => ({ [field]: { [Op.iLike]: `%${search}%` } }));
  }
  for (const [queryKey, field, max] of [
    ["estado", "estado", 80],
    ["tipo", "tipo", 100],
    ["formaPago", "formaPago", 120],
  ]) {
    const value = normalizarTexto(query[queryKey], max);
    if (value) where[field] = value;
  }
  const start = normalizarFecha(query.fechaInicio);
  const end = normalizarFecha(query.fechaFin);
  if (start || end) {
    where.fechaFactura = {};
    if (start) where.fechaFactura[Op.gte] = start;
    if (end) where.fechaFactura[Op.lte] = end;
  }
  return where;
};

const listar = async (query = {}) => {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(query.limit) || 25));
  const where = normalizarFiltros(query);
  const { rows, count } = await FacturaRegistro.findAndCountAll({
    where,
    attributes: { exclude: ["payloadOriginal"] },
    order: [["fechaFactura", "DESC"], ["id", "DESC"]],
    limit,
    offset: (page - 1) * limit,
  });
  const [sumaSubtotal, sumaIva, sumaTotal] = await Promise.all([
    FacturaRegistro.sum("subtotal", { where }),
    FacturaRegistro.sum("iva", { where }),
    FacturaRegistro.sum("total", { where }),
  ]);
  const catalogRows = await FacturaRegistro.findAll({
    attributes: ["estado", "tipo", "formaPago"],
    group: ["estado", "tipo", "formaPago"],
    raw: true,
  });
  return {
    ok: true,
    facturas: rows.map(serializar),
    resumen: {
      cantidad: count,
      subtotal: Number(sumaSubtotal || 0),
      iva: Number(sumaIva || 0),
      total: Number(sumaTotal || 0),
    },
    catalogos: {
      estados: [...new Set(catalogRows.map((row) => row.estado).filter(Boolean))].sort(),
      tipos: [...new Set(catalogRows.map((row) => row.tipo).filter(Boolean))].sort(),
      formasPago: [...new Set(catalogRows.map((row) => row.formaPago).filter(Boolean))].sort(),
    },
    paginacion: {
      page,
      limit,
      total: count,
      totalPaginas: Math.max(1, Math.ceil(count / limit)),
    },
  };
};

module.exports = {
  FACTURA_IMAGE_EXTENSIONS,
  MAX_FACTURA_IMAGE_BYTES,
  MAX_JSON_BYTES,
  actualizarFactura,
  cargarExcel,
  cargarJson,
  cargarJsonTexto,
  extraerFacturas,
  guardarFotoFactura,
  listar,
  normalizarFecha,
  normalizarFactura,
  normalizarMonto,
  parsearExcel,
  validarFotoFactura,
  validarNumerosFacturaDisponibles,
};
