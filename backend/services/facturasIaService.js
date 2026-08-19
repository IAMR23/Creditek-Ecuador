const crypto = require("crypto");
const path = require("path");
const { TextDecoder } = require("util");
const { Op, fn, col } = require("sequelize");

const { sequelize } = require("../config/db");
const FacturaIaResultado = require("../models/FacturaIaResultado");
const Usuario = require("../models/Usuario");

const MAX_JSON_BYTES = 2 * 1024 * 1024;
const MAX_FACTURAS_POR_ARCHIVO = 100;
const MAX_EXPORT_ROWS = 1000;
const TOLERANCIA = 0.02;
const CAMPOS_NUMERICOS = [
  "subtotal",
  "impuestos",
  "total",
  "totalProductosCalculado",
  "diferenciaProductosSubtotal",
  "diferenciaSubtotalImpuestosTotal",
  "puntaje",
];

const includeUsuarios = [
  {
    model: Usuario,
    as: "creadoPor",
    attributes: ["id", "nombre"],
    required: false,
  },
  {
    model: Usuario,
    as: "seleccionadoPor",
    attributes: ["id", "nombre"],
    required: false,
  },
];

const crearError = (message, statusCode = 400, extra = {}) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  Object.assign(error, extra);
  return error;
};

const normalizarId = (value, label = "El registro") => {
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1) throw crearError(`${label} no es valido`);
  return id;
};

const normalizarTexto = (value, max = 255) => {
  if (value === undefined || value === null) return null;
  const text = String(value).replaceAll("\u0000", "").trim();
  return text ? text.slice(0, max) : null;
};

const obtenerRuta = (value, route) =>
  route.reduce(
    (current, key) =>
      current && typeof current === "object" ? current[key] : undefined,
    value,
  );

const primerValor = (value, routes) => {
  for (const route of routes) {
    const result = obtenerRuta(value, route);
    if (result !== undefined && result !== null && result !== "") return result;
  }
  return null;
};

const normalizarNumero = (value) => {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === "number") {
    return Number.isFinite(value) && value >= 0
      ? Number(value.toFixed(6))
      : null;
  }
  let text = String(value).trim().replace(/[^0-9,.-]/g, "");
  if (!text || text.includes("-") || !/\d/.test(text)) return null;
  const comma = text.lastIndexOf(",");
  const dot = text.lastIndexOf(".");
  if (comma >= 0 && dot >= 0) {
    const decimal = comma > dot ? "," : ".";
    const thousands = decimal === "," ? "." : ",";
    text = text.replaceAll(thousands, "").replace(decimal, ".");
  } else if (comma >= 0) {
    const decimalLength = text.length - comma - 1;
    text = decimalLength >= 1 && decimalLength <= 6
      ? text.replaceAll(".", "").replace(",", ".")
      : text.replaceAll(",", "");
  } else if ((text.match(/\./g) || []).length > 1) {
    const pieces = text.split(".");
    const decimal = pieces.pop();
    text = decimal.length <= 6 ? `${pieces.join("")}.${decimal}` : `${pieces.join("")}${decimal}`;
  }
  const number = Number(text);
  if (!Number.isFinite(number) || number < 0 || number > 999999999999) return null;
  return Number(number.toFixed(6));
};

const normalizarFecha = (value) => {
  const text = normalizarTexto(value, 40);
  if (!text) return null;
  let match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) {
    const latin = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
    if (latin) match = [latin[0], latin[3], latin[2].padStart(2, "0"), latin[1].padStart(2, "0")];
  }
  if (!match) return null;
  const iso = `${match[1]}-${match[2]}-${match[3]}`;
  const date = new Date(`${iso}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === iso
    ? iso
    : null;
};

const normalizarProducto = (product, index, warnings) => {
  const description = normalizarTexto(
    primerValor(product, [
      ["descripcion"],
      ["description"],
      ["producto"],
      ["nombre"],
    ]),
    500,
  );
  const quantity = normalizarNumero(
    primerValor(product, [["cantidad"], ["quantity"], ["qty"]]),
  );
  const unitPrice = normalizarNumero(
    primerValor(product, [
      ["precioUnitario"],
      ["precio_unitario"],
      ["unitPrice"],
      ["valorUnitario"],
    ]),
  );
  const discount = normalizarNumero(
    primerValor(product, [["descuento"], ["discount"]]),
  );
  const sourceTotal = normalizarNumero(
    primerValor(product, [
      ["total"],
      ["totalLinea"],
      ["total_linea"],
      ["valorTotal"],
    ]),
  );
  const calculatedTotal =
    quantity !== null && unitPrice !== null
      ? Number(Math.max(0, quantity * unitPrice - (discount || 0)).toFixed(6))
      : null;
  if (sourceTotal === null && calculatedTotal !== null) {
    warnings.push(`Producto ${index + 1}: el total de linea fue calculado porque no vino en el JSON.`);
  }
  if (sourceTotal !== null && calculatedTotal !== null && Math.abs(sourceTotal - calculatedTotal) > TOLERANCIA) {
    warnings.push(`Producto ${index + 1}: cantidad, precio y total de linea no coinciden.`);
  }
  if (!description) warnings.push(`Producto ${index + 1}: no tiene descripcion.`);
  return {
    orden: index + 1,
    codigo: normalizarTexto(primerValor(product, [["codigo"], ["code"], ["sku"]]), 80),
    descripcion: description,
    cantidad: quantity,
    precioUnitario: unitPrice,
    descuento: discount,
    totalFuente: sourceTotal,
    totalCalculado: calculatedTotal,
    totalUsado: sourceTotal ?? calculatedTotal,
  };
};

const calcularPuntaje = ({ fields, products, warnings, arithmetic }) => {
  let score = 0;
  if (fields.proveedor) score += 10;
  if (fields.rucProveedor) score += 10;
  if (fields.numeroFactura) score += 10;
  if (fields.fechaEmision) score += 10;
  if (fields.subtotal !== null) score += 5;
  if (fields.impuestos !== null) score += 5;
  if (fields.total !== null) score += 5;
  if (products.length) score += 15;
  if (products.length && products.every((product) => product.descripcion && product.totalUsado !== null)) score += 5;
  if (arithmetic.invoiceMatches) score += 10;
  if (arithmetic.productsMatch) score += 10;
  if (!warnings.length) score += 5;
  return Number(Math.max(0, Math.min(100, score)).toFixed(2));
};

const normalizarFacturaPayload = (payload) => {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw crearError("Cada factura del JSON debe ser un objeto");
  }
  const warnings = Array.isArray(payload.advertencias)
    ? payload.advertencias.map((item) => normalizarTexto(item, 500)).filter(Boolean)
    : [];
  const productsSource = primerValor(payload, [
    ["productos"],
    ["items"],
    ["detalles"],
    ["factura", "productos"],
    ["detalle", "productos"],
  ]);
  const products = Array.isArray(productsSource)
    ? productsSource.slice(0, 1000).map((product, index) =>
        normalizarProducto(product || {}, index, warnings),
      )
    : [];
  if (!products.length) warnings.push("El JSON no contiene productos reconocibles.");

  const fields = {
    proveedor: normalizarTexto(primerValor(payload, [
      ["proveedor", "nombre"], ["proveedor"], ["emisor", "nombre"], ["razonSocial"],
    ]), 255),
    rucProveedor: normalizarTexto(primerValor(payload, [
      ["proveedor", "ruc"], ["rucProveedor"], ["emisor", "ruc"], ["ruc"],
    ]), 30),
    numeroFactura: normalizarTexto(primerValor(payload, [
      ["factura", "numero"], ["numeroFactura"], ["numero"], ["factura", "numeroFactura"],
    ]), 80),
    fechaEmision: normalizarFecha(primerValor(payload, [
      ["factura", "fechaEmision"], ["fechaEmision"], ["fecha"],
    ])),
    subtotal: normalizarNumero(primerValor(payload, [["factura", "subtotal"], ["subtotal"]])),
    impuestos: normalizarNumero(primerValor(payload, [
      ["factura", "impuestos"], ["factura", "iva"], ["impuestos"], ["iva"],
    ])),
    total: normalizarNumero(primerValor(payload, [["factura", "total"], ["total"]])),
  };
  if (!fields.proveedor) warnings.push("No se encontro el proveedor.");
  if (!fields.numeroFactura) warnings.push("No se encontro el numero de factura.");
  if (fields.total === null) warnings.push("No se encontro el total de la factura.");

  const usableProductTotals = products
    .map((product) => product.totalUsado)
    .filter((value) => value !== null);
  const productTotal = usableProductTotals.length
    ? Number(usableProductTotals.reduce((sum, value) => sum + value, 0).toFixed(6))
    : null;
  const productsDifference = productTotal !== null && fields.subtotal !== null
    ? Number((productTotal - fields.subtotal).toFixed(6))
    : null;
  const invoiceDifference = fields.subtotal !== null && fields.impuestos !== null && fields.total !== null
    ? Number((fields.subtotal + fields.impuestos - fields.total).toFixed(6))
    : null;
  const arithmetic = {
    productsMatch: productsDifference !== null && Math.abs(productsDifference) <= TOLERANCIA,
    invoiceMatches: invoiceDifference !== null && Math.abs(invoiceDifference) <= TOLERANCIA,
  };
  if (productsDifference !== null && !arithmetic.productsMatch) {
    warnings.push("La suma de productos no coincide con el subtotal informado.");
  }
  if (invoiceDifference !== null && !arithmetic.invoiceMatches) {
    warnings.push("Subtotal mas impuestos no coincide con el total informado.");
  }
  const uniqueWarnings = [...new Set(warnings)];
  const normalized = {
    proveedor: {
      nombre: fields.proveedor,
      ruc: fields.rucProveedor,
    },
    factura: {
      numero: fields.numeroFactura,
      fechaEmision: fields.fechaEmision,
      subtotal: fields.subtotal,
      impuestos: fields.impuestos,
      total: fields.total,
    },
    cliente: {
      nombre: normalizarTexto(primerValor(payload, [["cliente", "nombre"], ["cliente"]]), 255),
      identificacion: normalizarTexto(primerValor(payload, [
        ["cliente", "identificacion"], ["identificacionCliente"], ["cliente", "ruc"],
      ]), 30),
    },
    productos: products,
    sumatoria: {
      totalProductosCalculado: productTotal,
      diferenciaProductosSubtotal: productsDifference,
      diferenciaSubtotalImpuestosTotal: invoiceDifference,
      productosCoincidenConSubtotal: arithmetic.productsMatch,
      facturaCuadra: arithmetic.invoiceMatches,
    },
    textoCompleto: normalizarTexto(primerValor(payload, [["textoCompleto"], ["texto"], ["ocrTexto"]]), 100000),
    datosAdicionales:
      payload.datosAdicionales && typeof payload.datosAdicionales === "object"
        ? payload.datosAdicionales
        : {},
  };
  return {
    fields,
    products,
    normalized,
    warnings: uniqueWarnings,
    totalProductosCalculado: productTotal,
    diferenciaProductosSubtotal: productsDifference,
    diferenciaSubtotalImpuestosTotal: invoiceDifference,
    puntaje: calcularPuntaje({ fields, products, warnings: uniqueWarnings, arithmetic }),
  };
};

const extraerFacturasPayload = (payload) => {
  const values = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.facturas)
      ? payload.facturas
      : [payload];
  if (!values.length) throw crearError("El JSON no contiene facturas");
  if (values.length > MAX_FACTURAS_POR_ARCHIVO) {
    throw crearError(`Cada JSON puede contener maximo ${MAX_FACTURAS_POR_ARCHIVO} facturas`);
  }
  return values;
};

const sanitizarGrupo = (value) =>
  normalizarTexto(value, 160)?.replace(/[\r\n\t]/g, " ") || null;

const crearGrupo = ({ requestedGroup, normalized, filename, index }) => {
  const requested = sanitizarGrupo(requestedGroup);
  if (requested) return requested;
  const ruc = normalized.fields.rucProveedor || "SIN-RUC";
  const number = normalized.fields.numeroFactura || "SIN-NUMERO";
  if (ruc !== "SIN-RUC" || number !== "SIN-NUMERO") return `${ruc} | ${number}`.slice(0, 160);
  return `${path.parse(filename).name || "FACTURA-IA"} | ${index + 1}`.slice(0, 160);
};

const validarArchivoJson = (file) => {
  if (!file || !Buffer.isBuffer(file.buffer)) throw crearError("Selecciona un archivo JSON");
  if (file.size <= 0) throw crearError("El archivo JSON esta vacio");
  if (file.size > MAX_JSON_BYTES) throw crearError("El archivo JSON supera el limite de 2 MB");
  const extension = path.extname(file.originalname || "").toLowerCase();
  if (extension !== ".json") throw crearError("Solo se permiten archivos con extension .json");
};

const parsearJsonUtf8 = (buffer) => {
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

const serializarResultado = (value, extra = {}) => {
  const result = typeof value?.toJSON === "function" ? value.toJSON() : { ...value };
  for (const field of CAMPOS_NUMERICOS) {
    result[field] = result[field] === null || result[field] === undefined
      ? null
      : Number(result[field]);
  }
  return { ...result, ...extra };
};

const cargarArchivoJson = async ({ file, grupoComparacion, usuarioId }) => {
  validarArchivoJson(file);
  const userId = normalizarId(usuarioId, "El usuario");
  const payload = parsearJsonUtf8(file.buffer);
  const invoices = extraerFacturasPayload(payload);
  const filename = path.basename(file.originalname || "factura-ia.json").slice(0, 255);
  const sha256 = crypto.createHash("sha256").update(file.buffer).digest("hex");
  const created = await sequelize.transaction(async (transaction) => {
    const rows = [];
    for (const [index, invoicePayload] of invoices.entries()) {
      const normalized = normalizarFacturaPayload(invoicePayload);
      rows.push(await FacturaIaResultado.create({
        grupoComparacion: crearGrupo({
          requestedGroup: grupoComparacion,
          normalized,
          filename,
          index,
        }),
        nombreArchivoJson: filename,
        sha256,
        proveedor: normalized.fields.proveedor,
        rucProveedor: normalized.fields.rucProveedor,
        numeroFactura: normalized.fields.numeroFactura,
        fechaEmision: normalized.fields.fechaEmision,
        subtotal: normalized.fields.subtotal,
        impuestos: normalized.fields.impuestos,
        total: normalized.fields.total,
        totalProductosCalculado: normalized.totalProductosCalculado,
        diferenciaProductosSubtotal: normalized.diferenciaProductosSubtotal,
        diferenciaSubtotalImpuestosTotal: normalized.diferenciaSubtotalImpuestosTotal,
        cantidadProductos: normalized.products.length,
        puntaje: normalized.puntaje,
        payloadOriginal: invoicePayload,
        payloadNormalizado: normalized.normalized,
        advertencias: normalized.warnings,
        creadoPorId: userId,
      }, { transaction }));
    }
    return rows;
  });
  return created.map((row) => serializarResultado(row));
};

const normalizarFiltros = (query = {}) => {
  const where = {};
  const and = [];
  const search = normalizarTexto(query.busqueda, 120);
  if (search) {
    and.push({
      [Op.or]: ["grupoComparacion", "proveedor", "rucProveedor", "numeroFactura", "nombreArchivoJson"]
        .map((field) => ({ [field]: { [Op.iLike]: `%${search}%` } })),
    });
  }
  const group = sanitizarGrupo(query.grupoComparacion);
  if (group) where.grupoComparacion = group;
  if (["true", "false"].includes(String(query.seleccionada))) {
    where.esSeleccionada = String(query.seleccionada) === "true";
  }
  const start = normalizarFecha(query.fechaInicio);
  const end = normalizarFecha(query.fechaFin);
  if (start || end) {
    where.createdAt = {};
    if (start) where.createdAt[Op.gte] = new Date(`${start}T00:00:00.000Z`);
    if (end) where.createdAt[Op.lte] = new Date(`${end}T23:59:59.999Z`);
  }
  if (and.length) where[Op.and] = and;
  return where;
};

const obtenerRecomendaciones = async (groups) => {
  if (!groups.length) return new Map();
  const rows = await FacturaIaResultado.findAll({
    attributes: ["grupoComparacion", [fn("MAX", col("puntaje")), "puntajeMaximo"]],
    where: { grupoComparacion: { [Op.in]: groups } },
    group: ["grupoComparacion"],
    raw: true,
  });
  return new Map(rows.map((row) => [row.grupoComparacion, Number(row.puntajeMaximo)]));
};

const listarResultados = async (query = {}) => {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 50));
  const where = normalizarFiltros(query);
  const { rows, count } = await FacturaIaResultado.findAndCountAll({
    where,
    attributes: { exclude: ["payloadOriginal", "payloadNormalizado"] },
    include: includeUsuarios,
    order: [["createdAt", "DESC"], ["id", "DESC"]],
    limit,
    offset: (page - 1) * limit,
    distinct: true,
  });
  const recommendations = await obtenerRecomendaciones([...new Set(rows.map((row) => row.grupoComparacion))]);
  const selectedWhere = { ...where, esSeleccionada: true };
  const [selectedCount, selectedTotal] = await Promise.all([
    FacturaIaResultado.count({ where: selectedWhere }),
    FacturaIaResultado.sum("total", { where: selectedWhere }),
  ]);
  return {
    ok: true,
    resultados: rows.map((row) => serializarResultado(row, {
      esRecomendada: Number(row.puntaje) === recommendations.get(row.grupoComparacion),
    })),
    resumen: {
      totalResultados: count,
      totalSeleccionadas: selectedCount,
      sumaTotalSeleccionadas: Number(selectedTotal || 0),
    },
    paginacion: {
      page,
      limit,
      total: count,
      totalPaginas: Math.max(1, Math.ceil(count / limit)),
    },
  };
};

const obtenerResultado = async (idValue) => {
  const id = normalizarId(idValue, "La carga IA");
  const result = await FacturaIaResultado.findByPk(id, { include: includeUsuarios });
  if (!result) throw crearError("Resultado de factura IA no encontrado", 404);
  return serializarResultado(result);
};

const seleccionarResultado = async ({ id: idValue, usuarioId }) => {
  const id = normalizarId(idValue, "La carga IA");
  const userId = normalizarId(usuarioId, "El usuario");
  await sequelize.transaction(async (transaction) => {
    const result = await FacturaIaResultado.findByPk(id, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!result) throw crearError("Resultado de factura IA no encontrado", 404);
    await FacturaIaResultado.update(
      { esSeleccionada: false, seleccionadoPorId: null, seleccionadoEn: null },
      { where: { grupoComparacion: result.grupoComparacion, esSeleccionada: true }, transaction },
    );
    await result.update({
      esSeleccionada: true,
      seleccionadoPorId: userId,
      seleccionadoEn: new Date(),
    }, { transaction });
  });
  return obtenerResultado(id);
};

const listarParaExportar = async (query = {}) => {
  const where = normalizarFiltros(query);
  const count = await FacturaIaResultado.count({ where });
  if (count > MAX_EXPORT_ROWS) {
    throw crearError(`La exportacion supera ${MAX_EXPORT_ROWS} resultados; aplica mas filtros.`, 422);
  }
  const rows = await FacturaIaResultado.findAll({
    where,
    attributes: { exclude: ["payloadOriginal"] },
    include: includeUsuarios,
    order: [["grupoComparacion", "ASC"], ["puntaje", "DESC"], ["id", "ASC"]],
  });
  const recommendations = await obtenerRecomendaciones([
    ...new Set(rows.map((row) => row.grupoComparacion)),
  ]);
  return rows.map((row) => serializarResultado(row, {
    esRecomendada: Number(row.puntaje) === recommendations.get(row.grupoComparacion),
  }));
};

module.exports = {
  MAX_JSON_BYTES,
  cargarArchivoJson,
  extraerFacturasPayload,
  listarParaExportar,
  listarResultados,
  normalizarFacturaPayload,
  normalizarNumero,
  obtenerResultado,
  seleccionarResultado,
};
