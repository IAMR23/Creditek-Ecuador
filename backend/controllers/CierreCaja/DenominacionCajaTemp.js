const { Op } = require("sequelize");
const { sequelize } = require("../../config/db");
const CierreCaja = require("../../models/CierreCaja/CierreCaja");
const DenominacionCajaHistorial = require("../../models/CierreCaja/DenominacionCajaHistorial");
const DenominacionCajaTemp = require("../../models/CierreCaja/DenominacionCajaTemp");
const UsuarioAgencia = require("../../models/UsuarioAgencia");

const DENOMINACIONES_PERMITIDAS = [100, 50, 20, 10, 5, 1, 0.5, 0.25, 0.1, 0.05, 0.01];
const ESTADOS_CIERRE_ACTIVOS = ["CERRADO", "REABIERTO"];

const obtenerFechaEcuador = (fecha = new Date()) =>
  fecha.toLocaleDateString("en-CA", { timeZone: "America/Guayaquil" });

const esFechaISOValida = (fecha) =>
  typeof fecha === "string" && /^\d{4}-\d{2}-\d{2}$/.test(fecha);

const redondearDosDecimales = (valor) =>
  Number((Number(valor) || 0).toFixed(2));

const crearKeyValor = (valor) => redondearDosDecimales(valor).toFixed(2);

const resolverRelacionUsuarioAgencia = async (req, transaction = null) => {
  if (req.user?.usuarioAgenciaId) {
    const relacion = await UsuarioAgencia.findOne({
      where: {
        id: req.user.usuarioAgenciaId,
        activo: true,
        ...(req.user?.id && { usuarioId: req.user.id }),
        ...(req.user?.agenciaId && { agenciaId: req.user.agenciaId }),
      },
      attributes: ["id", "usuarioId", "agenciaId"],
      transaction,
    });

    return relacion;
  }

  if (!req.user?.id || !req.user?.agenciaId) return null;

  return UsuarioAgencia.findOne({
    where: {
      usuarioId: req.user.id,
      agenciaId: req.user.agenciaId,
      activo: true,
    },
    attributes: ["id", "usuarioId", "agenciaId"],
    transaction,
  });
};

const validarCajaAbierta = async ({ usuarioId, fecha, transaction = null }) => {
  const cierre = await CierreCaja.findOne({
    where: {
      usuarioId,
      fecha,
      estadoCierre: { [Op.in]: ESTADOS_CIERRE_ACTIVOS },
    },
    transaction,
  });

  return cierre;
};

const normalizarDenominaciones = (denominaciones = []) => {
  if (!Array.isArray(denominaciones)) {
    return { error: "Las denominaciones deben enviarse como arreglo" };
  }

  const permitidas = new Set(DENOMINACIONES_PERMITIDAS.map(crearKeyValor));
  const vistas = new Set();
  const data = [];

  for (const item of denominaciones) {
    const valor = redondearDosDecimales(item?.valor ?? item?.denominacion);
    const cantidad = Number(item?.cantidad);
    const key = crearKeyValor(valor);

    if (!permitidas.has(key)) {
      return { error: `Denominacion invalida: ${item?.valor ?? item?.denominacion}` };
    }

    if (!Number.isInteger(cantidad) || cantidad < 0) {
      return { error: `Cantidad invalida para la denominacion ${valor}` };
    }

    if (vistas.has(key)) {
      return { error: `Denominacion duplicada: ${valor}` };
    }

    vistas.add(key);
    data.push({ valor, cantidad });
  }

  return { data };
};

const completarDenominacionesBase = (denominaciones = []) => {
  const existentes = new Map(
    denominaciones.map((item) => [
      crearKeyValor(item.valor),
      {
        valor: redondearDosDecimales(item.valor),
        cantidad: Number(item.cantidad) || 0,
      },
    ]),
  );

  return DENOMINACIONES_PERMITIDAS.map((valor) => {
    const existente = existentes.get(crearKeyValor(valor));
    const cantidad = existente?.cantidad || 0;

    return {
      valor,
      denominacion: valor,
      cantidad,
      total: redondearDosDecimales(valor * cantidad),
    };
  });
};

const calcularTotalFisico = (denominaciones = []) =>
  redondearDosDecimales(
    denominaciones.reduce(
      (total, item) => total + (Number(item.valor) || 0) * (Number(item.cantidad) || 0),
      0,
    ),
  );

const crearHistorialDenominaciones = async ({
  denominaciones,
  relacion,
  usuarioId,
  accion,
  cierreId = null,
  fechaSnapshot = new Date(),
  transaction = null,
}) => {
  if (!denominaciones.length) return;

  await DenominacionCajaHistorial.bulkCreate(
    denominaciones.map((item) => ({
      usuarioAgenciaId: relacion.id,
      agenciaId: relacion.agenciaId,
      usuarioId,
      cierreId,
      valor: item.valor,
      cantidad: item.cantidad,
      total: redondearDosDecimales(item.valor * item.cantidad),
      accion,
      creadoPorUsuarioId: usuarioId,
      fechaSnapshot,
    })),
    { transaction },
  );
};

const obtenerDenominacionesTempParaCierre = async ({
  usuarioAgenciaId,
  transaction = null,
}) => {
  const registros = await DenominacionCajaTemp.findAll({
    where: { usuarioAgenciaId, estado: "ACTIVO" },
    order: [["valor", "DESC"]],
    transaction,
  });

  return registros.map((registro) => ({
    valor: redondearDosDecimales(registro.valor),
    denominacion: redondearDosDecimales(registro.valor),
    cantidad: Number(registro.cantidad) || 0,
  }));
};

const limpiarDenominacionesTemp = async ({ usuarioAgenciaId, transaction = null }) =>
  DenominacionCajaTemp.destroy({
    where: { usuarioAgenciaId, estado: "ACTIVO" },
    transaction,
  });

const obtenerDenominacionesTemp = async (req, res) => {
  try {
    const relacion = await resolverRelacionUsuarioAgencia(req);
    if (!relacion) {
      return res.status(400).json({ ok: false, message: "Usuario no identificado" });
    }

    const fecha = esFechaISOValida(req.query?.fecha)
      ? req.query.fecha
      : obtenerFechaEcuador();
    const cierre = await validarCajaAbierta({ usuarioId: req.user.id, fecha });
    const registros = await DenominacionCajaTemp.findAll({
      where: { usuarioAgenciaId: relacion.id, estado: "ACTIVO" },
      order: [["valor", "DESC"]],
    });
    const data = completarDenominacionesBase(registros);

    return res.json({
      ok: true,
      cerrado: !!cierre,
      fecha,
      data,
      totalFisico: calcularTotalFisico(data),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      ok: false,
      message: "Error al obtener denominaciones",
    });
  }
};

const guardarDenominacionesTemp = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const relacion = await resolverRelacionUsuarioAgencia(req, t);
    if (!relacion) {
      await t.rollback();
      return res.status(400).json({ ok: false, message: "Usuario no identificado" });
    }

    const fecha = esFechaISOValida(req.body?.fecha)
      ? req.body.fecha
      : obtenerFechaEcuador();
    const cierre = await validarCajaAbierta({
      usuarioId: req.user.id,
      fecha,
      transaction: t,
    });

    if (cierre) {
      await t.rollback();
      return res.status(409).json({
        ok: false,
        message: "La caja de la fecha seleccionada ya fue cerrada para este usuario",
      });
    }

    const normalizadas = normalizarDenominaciones(req.body?.denominaciones || []);
    if (normalizadas.error) {
      await t.rollback();
      return res.status(400).json({ ok: false, message: normalizadas.error });
    }

    const data = completarDenominacionesBase(normalizadas.data);
    const fechaActualizacion = new Date();

    await DenominacionCajaTemp.destroy({
      where: { usuarioAgenciaId: relacion.id, estado: "ACTIVO" },
      transaction: t,
    });

    await DenominacionCajaTemp.bulkCreate(
      data.map((item) => ({
        usuarioAgenciaId: relacion.id,
        agenciaId: relacion.agenciaId,
        usuarioId: req.user.id,
        valor: item.valor,
        cantidad: item.cantidad,
        estado: "ACTIVO",
        actualizadoPorUsuarioId: req.user.id,
        fechaActualizacion,
      })),
      { transaction: t },
    );

    await crearHistorialDenominaciones({
      denominaciones: data,
      relacion,
      usuarioId: req.user.id,
      accion: "ACTUALIZACION",
      fechaSnapshot: fechaActualizacion,
      transaction: t,
    });

    await t.commit();

    return res.json({
      ok: true,
      message: "Denominaciones guardadas",
      data,
      totalFisico: calcularTotalFisico(data),
    });
  } catch (error) {
    await t.rollback();
    console.error(error);
    return res.status(500).json({
      ok: false,
      message: "Error al guardar denominaciones",
    });
  }
};

module.exports = {
  crearHistorialDenominaciones,
  guardarDenominacionesTemp,
  limpiarDenominacionesTemp,
  obtenerDenominacionesTemp,
  obtenerDenominacionesTempParaCierre,
};
