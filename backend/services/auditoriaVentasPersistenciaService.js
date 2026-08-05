const { Op } = require("sequelize");
const AuditoriaVentaPdf = require("../models/AuditoriaVentaPdf");

const TIPOS_VALIDOS = new Set(["TV", "CELULAR"]);
const FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const normalizarTipo = (tipo) => String(tipo || "").trim().toUpperCase();

const validarFecha = (fecha, campo) => {
  const valor = String(fecha || "").trim();
  if (!FECHA_REGEX.test(valor)) {
    const error = new Error(`${campo} debe tener formato YYYY-MM-DD`);
    error.statusCode = 400;
    throw error;
  }
  const fechaValidada = new Date(`${valor}T00:00:00.000Z`);
  if (
    Number.isNaN(fechaValidada.getTime()) ||
    fechaValidada.toISOString().slice(0, 10) !== valor
  ) {
    const error = new Error(`${campo} no es una fecha valida`);
    error.statusCode = 400;
    throw error;
  }
  return valor;
};

const toPlain = (registro) =>
  registro?.get ? registro.get({ plain: true }) : registro;

const guardarAuditoriaVentasPdf = async ({
  auditoriaId,
  tipo,
  fechaInicio,
  fechaFin,
  origen = "MANUAL",
  estado = "COMPLETADA",
  registrosPdf = [],
  resultados = [],
  resumen = {},
  errores = [],
  usuarioId = null,
  controlFinancieroCargaId = null,
}) => {
  const tipoNormalizado = normalizarTipo(tipo);
  if (!TIPOS_VALIDOS.has(tipoNormalizado)) {
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
  const origenNormalizado = String(origen || "MANUAL").trim().toUpperCase();

  const payload = {
    tipo: tipoNormalizado,
    fechaInicio: fechaInicioNormalizada,
    fechaFin: fechaFinNormalizada,
    origen: origenNormalizado,
    estado: String(estado || "COMPLETADA").trim().toUpperCase(),
    registrosPdf: Array.isArray(registrosPdf) ? registrosPdf : [],
    resultados: Array.isArray(resultados) ? resultados : [],
    resumen: resumen && typeof resumen === "object" ? resumen : {},
    errores: Array.isArray(errores) ? errores : [],
    usuarioId: usuarioId || null,
    controlFinancieroCargaId: controlFinancieroCargaId || null,
  };

  let auditoria = null;
  if (auditoriaId) {
    auditoria = await AuditoriaVentaPdf.findByPk(auditoriaId);
  }
  if (!auditoria && controlFinancieroCargaId) {
    auditoria = await AuditoriaVentaPdf.findOne({
      where: {
        controlFinancieroCargaId,
        tipo: tipoNormalizado,
      },
    });
  }
  if (
    !auditoria &&
    !controlFinancieroCargaId &&
    origenNormalizado === "CONTROL_FINANCIERO"
  ) {
    auditoria = await AuditoriaVentaPdf.findOne({
      where: {
        tipo: tipoNormalizado,
        fechaInicio: fechaInicioNormalizada,
        fechaFin: fechaFinNormalizada,
        origen: origenNormalizado,
        controlFinancieroCargaId: null,
      },
    });
  }

  if (auditoria) {
    await auditoria.update(payload);
    return toPlain(auditoria);
  }

  try {
    return toPlain(await AuditoriaVentaPdf.create(payload));
  } catch (error) {
    if (
      error.name !== "SequelizeUniqueConstraintError" ||
      !controlFinancieroCargaId
    ) {
      throw error;
    }

    const existente = await AuditoriaVentaPdf.findOne({
      where: {
        controlFinancieroCargaId,
        tipo: tipoNormalizado,
      },
    });
    if (!existente) throw error;

    await existente.update(payload);
    return toPlain(existente);
  }
};

const obtenerAuditoriaVentasPdfPorId = async (auditoriaId) => {
  if (!auditoriaId) return null;
  return toPlain(await AuditoriaVentaPdf.findByPk(auditoriaId));
};

const obtenerAuditoriaVentasPdfPrecargada = async ({
  tipo,
  fechaInicio,
  fechaFin,
  controlFinancieroCargaIds = [],
}) => {
  const tipoNormalizado = normalizarTipo(tipo);
  if (!TIPOS_VALIDOS.has(tipoNormalizado)) return null;

  const fechaInicioNormalizada = validarFecha(fechaInicio, "fechaInicio");
  const fechaFinNormalizada = validarFecha(fechaFin, "fechaFin");

  const where = {
    tipo: tipoNormalizado,
    fechaInicio: { [Op.lte]: fechaFinNormalizada },
    fechaFin: { [Op.gte]: fechaInicioNormalizada },
  };
  if (controlFinancieroCargaIds.length) {
    where.controlFinancieroCargaId = {
      [Op.in]: controlFinancieroCargaIds,
    };
  }

  const auditoria = await AuditoriaVentaPdf.findOne({
    where,
    order: [["updatedAt", "DESC"]],
  });

  return toPlain(auditoria);
};

module.exports = {
  guardarAuditoriaVentasPdf,
  obtenerAuditoriaVentasPdfPorId,
  obtenerAuditoriaVentasPdfPrecargada,
};
