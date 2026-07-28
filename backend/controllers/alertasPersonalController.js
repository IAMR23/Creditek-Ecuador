const { Op } = require("sequelize");
const Usuario = require("../models/Usuario");
const NotificacionPersonal = require("../models/NotificacionPersonal");
const NotificacionPersonalLectura = require("../models/NotificacionPersonalLectura");
const {
  construirAlertasPersonal,
  obtenerFechaActualEcuador,
  obtenerRangoDiaEcuador,
  sumarDiasFecha,
} = require("../services/alertasPersonalService");
const {
  registrarAlertasPersonal,
} = require("../services/notificacionesPersonalService");

const obtenerAlertasDelDia = async (fechaActual) => {
  const fechaIngresoObjetivo = sumarDiasFecha(fechaActual, -15);
  const rangoActual = obtenerRangoDiaEcuador(fechaActual);
  const rangoCreacionObjetivo = obtenerRangoDiaEcuador(fechaIngresoObjetivo);
  const usuarios = await Usuario.findAll({
    attributes: [
      "id",
      "nombre",
      "fechaIngreso",
      "fechaSalida",
      "fechaSalidaRegistradaAt",
      "activo",
      "createdAt",
    ],
    where: {
      [Op.or]: [
        {
          createdAt: {
            [Op.gte]: rangoActual.inicio,
            [Op.lt]: rangoActual.fin,
          },
        },
        { fechaIngreso: fechaIngresoObjetivo, activo: true },
        {
          createdAt: {
            [Op.gte]: rangoCreacionObjetivo.inicio,
            [Op.lt]: rangoCreacionObjetivo.fin,
          },
          fechaIngreso: null,
          activo: true,
        },
        {
          fechaSalidaRegistradaAt: {
            [Op.gte]: rangoActual.inicio,
            [Op.lt]: rangoActual.fin,
          },
        },
      ],
    },
    order: [["nombre", "ASC"]],
  });

  return construirAlertasPersonal(usuarios, fechaActual);
};

const convertirNotificacion = (notificacion, lectura) => {
  const datos =
    typeof notificacion?.get === "function"
      ? notificacion.get({ plain: true })
      : notificacion;

  return {
    id: datos.id,
    tipo: datos.tipo,
    titulo: datos.titulo,
    mensaje: datos.mensaje,
    usuarioId: datos.usuarioReferenciaId,
    nombre: datos.nombreReferencia,
    fechaReferencia: datos.fechaReferencia,
    fechaEvento: datos.fechaEvento,
    prioridad: datos.prioridad,
    origen: datos.origen,
    creadaAt: datos.createdAt,
    leida: Boolean(lectura?.leidaAt),
    leidaAt: lectura?.leidaAt || null,
  };
};

const listarAlertasPersonal = async (req, res) => {
  try {
    const fechaActual = obtenerFechaActualEcuador();
    const alertasDelDia = await obtenerAlertasDelDia(fechaActual);
    await registrarAlertasPersonal(alertasDelDia, "RVE");

    const limitSolicitado = Number.parseInt(req.query.limit, 10);
    const offsetSolicitado = Number.parseInt(req.query.offset, 10);
    const limit = Number.isFinite(limitSolicitado)
      ? Math.min(Math.max(limitSolicitado, 1), 200)
      : 50;
    const offset = Number.isFinite(offsetSolicitado)
      ? Math.max(offsetSolicitado, 0)
      : 0;

    const [total, notificaciones, totalLeidas] = await Promise.all([
      NotificacionPersonal.count(),
      NotificacionPersonal.findAll({
        order: [
          ["createdAt", "DESC"],
          ["id", "DESC"],
        ],
        limit,
        offset,
      }),
      NotificacionPersonalLectura.count({
        where: {
          usuarioId: req.user.id,
          leidaAt: { [Op.ne]: null },
        },
      }),
    ]);
    const ids = notificaciones.map((notificacion) => notificacion.id);
    const lecturas = ids.length
      ? await NotificacionPersonalLectura.findAll({
          where: {
            usuarioId: req.user.id,
            notificacionId: { [Op.in]: ids },
          },
        })
      : [];
    const lecturasPorNotificacion = new Map(
      lecturas.map((lectura) => [Number(lectura.notificacionId), lectura]),
    );

    return res.json({
      fecha: fechaActual,
      total,
      noLeidas: Math.max(total - totalLeidas, 0),
      alertas: notificaciones.map((notificacion) =>
        convertirNotificacion(
          notificacion,
          lecturasPorNotificacion.get(Number(notificacion.id)),
        ),
      ),
      limit,
      offset,
      hayMas: offset + notificaciones.length < total,
    });
  } catch (error) {
    console.error("Error al consultar alertas de personal:", error);
    return res.status(500).json({
      message: "No fue posible consultar las alertas de personal.",
    });
  }
};

const actualizarLecturaAlertaPersonal = async (req, res) => {
  try {
    const notificacionId = Number(req.params.id);
    if (!Number.isInteger(notificacionId) || notificacionId <= 0) {
      return res.status(400).json({ message: "Notificación inválida." });
    }

    const notificacion = await NotificacionPersonal.findByPk(notificacionId);
    if (!notificacion) {
      return res.status(404).json({ message: "Notificación no encontrada." });
    }

    const leida = req.body?.leida !== false;
    const leidaAt = leida ? new Date() : null;
    const [lectura, creada] =
      await NotificacionPersonalLectura.findOrCreate({
        where: {
          notificacionId,
          usuarioId: req.user.id,
        },
        defaults: { leidaAt },
      });

    if (!creada && Boolean(lectura.leidaAt) !== leida) {
      lectura.leidaAt = leidaAt;
      await lectura.save();
    }

    return res.json({
      ok: true,
      notificacionId,
      leida,
      leidaAt: lectura.leidaAt || null,
    });
  } catch (error) {
    console.error("Error al actualizar la lectura de la notificación:", error);
    return res.status(500).json({
      message: "No fue posible actualizar la notificación.",
    });
  }
};

const marcarTodasLasAlertasLeidas = async (req, res) => {
  try {
    const notificaciones = await NotificacionPersonal.findAll({
      attributes: ["id"],
      raw: true,
    });
    const leidaAt = new Date();

    if (notificaciones.length > 0) {
      await NotificacionPersonalLectura.bulkCreate(
        notificaciones.map(({ id }) => ({
          notificacionId: id,
          usuarioId: req.user.id,
          leidaAt,
        })),
        {
          updateOnDuplicate: ["leidaAt", "updatedAt"],
        },
      );
    }

    return res.json({
      ok: true,
      actualizadas: notificaciones.length,
      noLeidas: 0,
    });
  } catch (error) {
    console.error("Error al marcar las notificaciones como leídas:", error);
    return res.status(500).json({
      message: "No fue posible marcar las notificaciones como leídas.",
    });
  }
};

module.exports = {
  actualizarLecturaAlertaPersonal,
  listarAlertasPersonal,
  marcarTodasLasAlertasLeidas,
};
