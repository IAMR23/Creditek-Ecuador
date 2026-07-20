const { Op } = require("sequelize");
const Usuario = require("../models/Usuario");
const {
  construirAlertasPersonal,
  obtenerFechaActualEcuador,
  sumarDiasFecha,
} = require("../services/alertasPersonalService");

const listarAlertasPersonal = async (_req, res) => {
  try {
    const fechaActual = obtenerFechaActualEcuador();
    const fechaIngresoObjetivo = sumarDiasFecha(fechaActual, -15);
    const usuarios = await Usuario.findAll({
      attributes: ["id", "nombre", "fechaIngreso", "fechaSalida", "activo"],
      where: {
        [Op.or]: [
          { fechaIngreso: fechaIngresoObjetivo, activo: true },
          { fechaSalida: fechaActual },
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
