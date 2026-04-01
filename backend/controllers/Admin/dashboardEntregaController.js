const { Op } = require("sequelize");
const Entrega = require("../../models/Entrega");
const UsuarioAgenciaEntrega = require("../../models/UsuarioAgenciaEntrega");
const UsuarioAgencia = require("../../models/UsuarioAgencia");

exports.getDashboardEntregas = async (req, res) => {
  try {
    let { fechaInicio, fechaFin, userId } = req.query;

    const whereBase = {
      estado: {  
        [Op.ne]: "Eliminado",
      },
    };

    if (fechaInicio || fechaFin) {
  const rango = {};

  if (fechaInicio) {
    rango[Op.gte] = fechaInicio; // "2026-04-01"
  }

  if (fechaFin) {
    rango[Op.lte] = fechaFin; // "2026-04-10"
  }

  whereBase.fecha = rango;
}

const includeMotorizado = {
  model: UsuarioAgencia,
  as: "repartidores",
  attributes: [],
  through: { attributes: [] },
  required: !!userId,
  ...(userId && {
    where: { id: userId },
  }),
};

    const estados = [
      "Pendiente",
      "Transito",
      "Revisar",
      "Entregado",
      "No Entregado",
    ];

    const counts = {};

    // 🔢 Conteo por estado
    for (const estado of estados) {
      counts[estado] = await Entrega.count({
        where: {
          ...whereBase,
          estado,
        },
        include: [includeMotorizado],
        distinct: true,
      });
    }

    // 🔢 Total
    const total = await Entrega.count({
      where: whereBase,
      include: [includeMotorizado],
      distinct: true,
    });

    res.json({
      filtros: {
        fechaInicio: fechaInicio || null,
        fechaFin: fechaFin || null,
        userId: userId || null,
      },
      total,
      porEstado: {
        pendiente: counts["Pendiente"],
        transito: counts["Transito"],
        revisar: counts["Revisar"],
        entregado: counts["Entregado"],
        noEntregado: counts["No Entregado"],
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Error generando dashboard",
    });
  }
};
