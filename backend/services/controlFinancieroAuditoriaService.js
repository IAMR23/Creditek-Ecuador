const { Op } = require("sequelize");
const ControlFinancieroCarga = require("../models/ControlFinancieroCarga");
const ControlFinancieroRegistro = require("../models/ControlFinancieroRegistro");

const TIPOS_CONTROL = {
  TV: "VENTA_TV",
  CELULAR: "VENTA_CELULAR",
};
const FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const normalizarTipo = (tipo) => String(tipo || "").trim().toUpperCase();

const validarFecha = (fecha, campo) => {
  const valor = String(fecha || "").trim();
  if (!FECHA_REGEX.test(valor)) {
    const error = new Error(`${campo} debe tener formato YYYY-MM-DD`);
    error.statusCode = 400;
    throw error;
  }
  return valor;
};

const toPlain = (registro) =>
  registro?.get ? registro.get({ plain: true }) : registro;

const toNumero = (value) => {
  const numero = Number(value);
  return Number.isFinite(numero) ? numero : 0;
};

const convertirRegistroControlAAuditoria = (registro, tipo) => {
  const item = toPlain(registro);
  const esTv = tipo === "TV";

  return {
    tipo_producto: tipo,
    origen: esTv ? "CONTROL_FINANCIERO_CREDITV" : "CONTROL_FINANCIERO_UPHONE",
    archivo_origen: item.archivoOrigen || "",
    factura: item.contrato || "",
    fecha: item.fecha || "",
    cliente: item.cliente || "",
    codigo_pdf: item.modelo || "",
    modelo_normalizado: item.modelo || "NO_MAPEADO",
    imei: esTv ? null : item.imei || "",
    cantidad: 1,
    precio: toNumero(item.ventas),
    valor_ventas: toNumero(item.ventas),
    valor_ventas_detectado: true,
    precio_vendedor: toNumero(item.ventas),
    precio_vendedor_detectado: true,
    entrada: toNumero(item.entradas),
    entrada_detectada: true,
  };
};

const contarArchivos = (registros) =>
  new Set(
    registros.map((registro) => {
      const item = toPlain(registro);
      return item.archivoHash || item.archivoOrigen || `REGISTRO:${item.id}`;
    }),
  ).size;

const obtenerRegistrosAuditoriaDesdeControlFinanciero = async ({
  tipo,
  fechaInicio,
  fechaFin,
}) => {
  const tipoNormalizado = normalizarTipo(tipo);
  const tipoRegistro = TIPOS_CONTROL[tipoNormalizado];
  if (!tipoRegistro) {
    const error = new Error("tipo debe ser TV o CELULAR");
    error.statusCode = 400;
    throw error;
  }

  const fechaInicioNormalizada = validarFecha(fechaInicio, "fechaInicio");
  const fechaFinNormalizada = validarFecha(fechaFin, "fechaFin");
  if (fechaInicioNormalizada > fechaFinNormalizada) {
    const error = new Error("fechaInicio no puede ser mayor que fechaFin");
    error.statusCode = 400;
    throw error;
  }

  const cargas = await ControlFinancieroCarga.findAll({
    where: {
      estado: "ACTIVA",
      fechaReporte: {
        [Op.between]: [fechaInicioNormalizada, fechaFinNormalizada],
      },
    },
    attributes: ["id", "fechaReporte"],
    order: [
      ["fechaReporte", "ASC"],
      ["id", "ASC"],
    ],
  });
  const cargasPlanas = cargas.map(toPlain);
  const cargaIds = cargasPlanas.map((carga) => Number(carga.id));

  if (!cargaIds.length) {
    return {
      tipo: tipoNormalizado,
      fechaInicio: fechaInicioNormalizada,
      fechaFin: fechaFinNormalizada,
      cargaIds: [],
      registrosPdf: [],
      totalRegistrosPdf: 0,
      pdfsProcesados: 0,
    };
  }

  const registros = await ControlFinancieroRegistro.findAll({
    where: {
      cargaId: { [Op.in]: cargaIds },
      tipoRegistro,
    },
    order: [
      ["cargaId", "ASC"],
      ["id", "ASC"],
    ],
  });

  return {
    tipo: tipoNormalizado,
    fechaInicio: fechaInicioNormalizada,
    fechaFin: fechaFinNormalizada,
    cargaIds,
    registrosPdf: registros.map((registro) =>
      convertirRegistroControlAAuditoria(registro, tipoNormalizado),
    ),
    totalRegistrosPdf: registros.length,
    pdfsProcesados: contarArchivos(registros),
  };
};

module.exports = {
  convertirRegistroControlAAuditoria,
  obtenerRegistrosAuditoriaDesdeControlFinanciero,
};
