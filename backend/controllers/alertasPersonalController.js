const { Op } = require("sequelize");
const Usuario = require("../models/Usuario");
const {
  construirAlertasPersonal,
  obtenerFechaActualEcuador,
  obtenerRangoDiaEcuador,
  sumarDiasFecha,
} = require("../services/alertasPersonalService");

const listarAlertasPersonal = async (_req, res) => {
  try {
    const fechaActual = obtenerFechaActualEcuador();
    const fechaIngresoObjetivo = sumarDiasFecha(fechaActual, -15);
    const rangoActual = obtenerRangoDiaEcuador(fechaActual);
    const rangoCreacionObjetivo = obtenerRangoDiaEcuador(
      fechaIngresoObjetivo,
    );
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
    const alertas = construirAlertasPersonal(usuarios, fechaActual);

    return res.json({
      fecha: fechaActual,
      total: alertas.length,
      alertas,
    });
  } catch (error) {
    console.error("Error al consultar alertas de personal:", error);
    return res.status(500).json({
      message: "No fue posible consultar las alertas de personal.",
    });
  }
};

module.exports = { listarAlertasPersonal };
