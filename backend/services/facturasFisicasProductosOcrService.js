const { Op } = require("sequelize");

const FacturaFisica = require("../models/FacturaFisica");
const FacturaFisicaProductoOcr = require("../models/FacturaFisicaProductoOcr");
const Usuario = require("../models/Usuario");

const MAX_PRODUCTOS_POR_OCR = 300;
const CAMPOS_EDITABLES = [
  "descripcion",
  "cantidad",
  "precioUnitario",
  "descuento",
  "totalLinea",
  "codigo",
];

const includeUsuarios = [
  {
    model: Usuario,
    as: "actualizadoPor",
    attributes: ["id", "nombre"],
    required: false,
  },
  {
    model: Usuario,
    as: "confirmadoPor",
    attributes: ["id", "nombre"],
    required: false,
  },
  {
    model: Usuario,
    as: "descartadoPor",
    attributes: ["id", "nombre"],
    required: false,
  },
];

const crearError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const normalizarId = (value, label) => {
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1) throw crearError(`${label} no es valido`);
  return id;
};

const normalizarTexto = (value, max, { requerido = false } = {}) => {
  if (value === undefined) {
    if (requerido) throw crearError("La descripcion del producto es obligatoria");
    return undefined;
  }
  if (value === null || value === "") {
    if (requerido) throw crearError("La descripcion del producto es obligatoria");
    return null;
  }
  const text = String(value).trim();
  if (!text && requerido) throw crearError("La descripcion del producto es obligatoria");
  if (text.length > max) throw crearError(`El texto no puede superar ${max} caracteres`);
  return text || null;
};

const normalizarNumeroTexto = (value) => {
  let text = String(value).trim().replace(/[^0-9,.-]/g, "");
  if (text.includes(",") && text.includes(".")) {
    const decimal = text.lastIndexOf(",") > text.lastIndexOf(".") ? "," : ".";
    const thousands = decimal === "," ? "." : ",";
    text = text.replaceAll(thousands, "").replace(decimal, ".");
  } else if (text.includes(",")) {
    text = text.replace(",", ".");
  }
  return text;
};

const normalizarDecimal = (
  value,
  label,
  { scale = 2, max = 9999999999.99, strictlyPositive = false } = {},
) => {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const number = Number(normalizarNumeroTexto(value));
  if (
    !Number.isFinite(number) ||
    number < 0 ||
    number > max ||
    (strictlyPositive && number <= 0)
  ) {
    throw crearError(`${label} no tiene un valor valido`);
  }
  return Number(number.toFixed(scale));
};

const normalizarAdvertencias = (value) =>
  Array.isArray(value)
    ? value
        .map((warning) => String(warning || "").trim().slice(0, 1000))
        .filter(Boolean)
        .slice(0, 20)
    : [];

const advertenciasCalculo = ({ cantidad, precioUnitario, descuento, totalLinea }) => {
  if (cantidad === null || precioUnitario === null || totalLinea === null) return [];
  const expected = cantidad * precioUnitario - (descuento || 0);
  return Math.abs(expected - totalLinea) > 0.02
    ? ["La cantidad por precio unitario no coincide con el total de linea."]
    : [];
};

const normalizarProductoDetectado = (value = {}, orden) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw crearError("El OCR devolvio una linea de producto invalida", 422);
  }
  const descripcion = normalizarTexto(value.descripcion, 500, { requerido: true });
  const cantidad = normalizarDecimal(value.cantidad, "La cantidad", {
    scale: 3,
    max: 1000000,
    strictlyPositive: true,
  });
  const precioUnitario = normalizarDecimal(value.precioUnitario, "El precio unitario");
  const descuento = normalizarDecimal(value.descuento, "El descuento");
  const totalLinea = normalizarDecimal(value.totalLinea, "El total de linea");
  const codigo = normalizarTexto(value.codigo, 80);
  const advertencias = [
    ...normalizarAdvertencias(value.advertencias),
    ...advertenciasCalculo({ cantidad, precioUnitario, descuento, totalLinea }),
  ];
  return {
    descripcion,
    cantidad: cantidad ?? null,
    precioUnitario: precioUnitario ?? null,
    descuento: descuento ?? null,
    totalLinea: totalLinea ?? null,
    codigo: codigo ?? null,
    advertencias: [...new Set(advertencias)],
    orden: Number.isInteger(Number(value.orden)) && Number(value.orden) > 0
      ? Number(value.orden)
      : orden,
  };
};

const validarProductosProcesador = (value) => {
  if (!Array.isArray(value)) return [];
  if (value.length > MAX_PRODUCTOS_POR_OCR) {
    throw crearError("El OCR devolvio demasiadas lineas de producto", 422);
  }
  return value.map((product, index) => normalizarProductoDetectado(product, index + 1));
};

const serializarProducto = (value) => {
  const product = typeof value?.toJSON === "function" ? value.toJSON() : value;
  if (!product) return null;
  return {
    ...product,
    cantidad: product.cantidad === null ? null : Number(product.cantidad),
    precioUnitario:
      product.precioUnitario === null ? null : Number(product.precioUnitario),
    descuento: product.descuento === null ? null : Number(product.descuento),
    totalLinea: product.totalLinea === null ? null : Number(product.totalLinea),
  };
};

const obtenerFactura = async (id, transaction) => {
  const factura = await FacturaFisica.findByPk(id, {
    attributes: ["id", "estado", "subtotal", "total"],
    transaction,
  });
  if (!factura) throw crearError("Factura fisica no encontrada", 404);
  return factura;
};

const resumenProductos = (products, factura) => {
  const considered = products.filter((product) => product.estado !== "DESCARTADO");
  const withTotal = considered.filter((product) => product.totalLinea !== null);
  const complete = considered.length > 0 && withTotal.length === considered.length;
  const sum = withTotal.reduce((total, product) => total + product.totalLinea, 0);
  const subtotal = factura.subtotal === null ? null : Number(factura.subtotal);
  const invoiceTotal = factura.total === null ? null : Number(factura.total);
  const warnings = [];
  let difference = null;
  let comparedWith = null;
  if (complete && subtotal !== null) {
    difference = Math.abs(sum - subtotal);
    comparedWith = "subtotal";
    if (difference > 0.02) {
      warnings.push("La suma de productos no coincide con el subtotal de la factura.");
    }
  } else if (complete && invoiceTotal !== null) {
    difference = Math.abs(sum - invoiceTotal);
    comparedWith = "total";
    if (difference > 0.02) {
      warnings.push("La suma de productos no coincide con el total de la factura.");
    }
  }
  return {
    cantidad: products.length,
    detectados: products.filter((product) => product.estado === "DETECTADO").length,
    confirmados: products.filter((product) => product.estado === "CONFIRMADO").length,
    descartados: products.filter((product) => product.estado === "DESCARTADO").length,
    sumaTotalesLinea: withTotal.length ? Number(sum.toFixed(2)) : null,
    sumaCompleta: complete,
    comparadoCon: comparedWith,
    diferencia: difference === null ? null : Number(difference.toFixed(2)),
    advertencias: warnings,
  };
};

const listarProductos = async (facturaIdValue) => {
  const facturaId = normalizarId(facturaIdValue, "La factura");
  const factura = await obtenerFactura(facturaId);
  const rows = await FacturaFisicaProductoOcr.findAll({
    where: { facturaFisicaId: facturaId, esResultadoActual: true },
    include: includeUsuarios,
    order: [["orden", "ASC"], ["id", "ASC"]],
  });
  const products = rows.map(serializarProducto);
  return { productos: products, resumen: resumenProductos(products, factura) };
};

const persistirProductosDetectados = async ({
  facturaId,
  productos,
  loteOcr,
  usuarioId,
  transaction,
}) => {
  const normalized = validarProductosProcesador(productos);
  const preserved = await FacturaFisicaProductoOcr.count({
    where: {
      facturaFisicaId: facturaId,
      esResultadoActual: true,
      [Op.or]: [
        { estado: "CONFIRMADO" },
        { estado: "DETECTADO", editadoManualmente: true },
      ],
    },
    transaction,
  });
  await FacturaFisicaProductoOcr.update(
    { esResultadoActual: false },
    {
      where: {
        facturaFisicaId: facturaId,
        esResultadoActual: true,
        [Op.or]: [
          { estado: "DESCARTADO" },
          { estado: "DETECTADO", editadoManualmente: false },
        ],
      },
      transaction,
    },
  );
  const maxVersion = await FacturaFisicaProductoOcr.max("versionOcr", {
    where: { facturaFisicaId: facturaId },
    transaction,
  });
  const versionOcr = (Number(maxVersion) || 0) + 1;
  if (normalized.length) {
    await FacturaFisicaProductoOcr.bulkCreate(
      normalized.map((product) => ({
        ...product,
        facturaFisicaId: facturaId,
        estado: "DETECTADO",
        loteOcr,
        versionOcr,
        esResultadoActual: true,
        editadoManualmente: false,
        detectadoPorId: usuarioId,
      })),
      { transaction },
    );
  }
  return { creados: normalized.length, preservados: Number(preserved) || 0, versionOcr };
};

const obtenerProductoEditable = async ({ facturaId, productoId }) => {
  const factura = await obtenerFactura(facturaId);
  if (factura.estado === "ANULADA") {
    throw crearError("No se pueden modificar productos de una factura anulada", 409);
  }
  const product = await FacturaFisicaProductoOcr.findOne({
    where: { id: productoId, facturaFisicaId: facturaId, esResultadoActual: true },
  });
  if (!product) throw crearError("Producto OCR no encontrado", 404);
  return product;
};

const editarProducto = async ({ facturaId: facturaValue, productoId: productValue, payload, usuarioId: userValue }) => {
  const facturaId = normalizarId(facturaValue, "La factura");
  const productoId = normalizarId(productValue, "El producto");
  const usuarioId = normalizarId(userValue, "El usuario");
  const product = await obtenerProductoEditable({ facturaId, productoId });
  if (product.estado !== "DETECTADO") {
    throw crearError("Solo se pueden editar productos pendientes de revision", 409);
  }
  const update = {};
  for (const field of CAMPOS_EDITABLES) {
    if (!Object.prototype.hasOwnProperty.call(payload || {}, field)) continue;
    if (field === "descripcion") {
      update[field] = normalizarTexto(payload[field], 500, { requerido: true });
    } else if (field === "codigo") {
      update[field] = normalizarTexto(payload[field], 80);
    } else if (field === "cantidad") {
      update[field] = normalizarDecimal(payload[field], "La cantidad", {
        scale: 3,
        max: 1000000,
        strictlyPositive: true,
      });
    } else {
      update[field] = normalizarDecimal(payload[field], `El campo ${field}`);
    }
  }
  if (!Object.keys(update).length) throw crearError("No se enviaron cambios validos");
  const merged = {
    cantidad:
      update.cantidad !== undefined
        ? update.cantidad
        : product.cantidad === null
          ? null
          : Number(product.cantidad),
    precioUnitario:
      update.precioUnitario !== undefined
        ? update.precioUnitario
        : product.precioUnitario === null
          ? null
          : Number(product.precioUnitario),
    descuento:
      update.descuento !== undefined
        ? update.descuento
        : product.descuento === null
          ? null
          : Number(product.descuento),
    totalLinea:
      update.totalLinea !== undefined
        ? update.totalLinea
        : product.totalLinea === null
          ? null
          : Number(product.totalLinea),
  };
  update.advertencias = advertenciasCalculo(merged);
  update.editadoManualmente = true;
  update.actualizadoPorId = usuarioId;
  await product.update(update);
  return serializarProducto(product);
};

const cambiarEstadoProducto = async ({
  facturaId: facturaValue,
  productoId: productValue,
  usuarioId: userValue,
  estado,
}) => {
  const facturaId = normalizarId(facturaValue, "La factura");
  const productoId = normalizarId(productValue, "El producto");
  const usuarioId = normalizarId(userValue, "El usuario");
  const product = await obtenerProductoEditable({ facturaId, productoId });
  const now = new Date();
  if (estado === "CONFIRMADO") {
    if (product.estado !== "DETECTADO") {
      throw crearError("Solo un producto detectado puede confirmarse", 409);
    }
    await product.update({
      estado,
      confirmadoPorId: usuarioId,
      confirmadoEn: now,
      actualizadoPorId: usuarioId,
    });
  } else if (estado === "DESCARTADO") {
    if (product.estado === "DESCARTADO") {
      throw crearError("El producto ya se encuentra descartado", 409);
    }
    await product.update({
      estado,
      descartadoPorId: usuarioId,
      descartadoEn: now,
      actualizadoPorId: usuarioId,
    });
  } else {
    throw crearError("El estado del producto no es valido");
  }
  return serializarProducto(product);
};

module.exports = {
  CAMPOS_EDITABLES,
  cambiarEstadoProducto,
  editarProducto,
  listarProductos,
  persistirProductosDetectados,
  validarProductosProcesador,
};
