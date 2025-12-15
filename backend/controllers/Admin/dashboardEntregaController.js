const { Op } = require("sequelize");
const Entrega = require("../../models/Entrega");

exports.getDashboardEntregas = async (req, res) => {
  try {

    let { fechaInicio, fechaFin } = req.query;

    if (!fechaInicio || !fechaFin) {
      return res.status(400).json({ message: "Debe enviar fechaInicio y fechaFin" });
    }

    // Convertir a Date
    fechaInicio = new Date(fechaInicio);
    fechaFin = new Date(fechaFin);

    // Ajustar fin del día
    fechaFin.setHours(23, 59, 59, 999);

    const estados = ["Pendiente", "Transito", "Revisar", "Entregado", "No entregado"];
    const counts = {};

    for (const estado of estados) {
      counts[estado.toLowerCase()] = await Entrega.count({
        where: {
          estado,
          fecha: {
            [Op.between]: [fechaInicio, fechaFin]
          }
        }
      });
    }

    const total = await Entrega.count({
      where: {
        fecha: { [Op.between]: [fechaInicio, fechaFin] }
      }
    });

    res.json({
      rango: { desde: fechaInicio, hasta: fechaFin },
      total,
      porEstado: {
        pendientes: counts["pendiente"],
        transito: counts["transito"],
        revisar: counts["revisar"],
        entregado: counts["entregado"],
        noEntregado: counts["no entregado"]
      }
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error generando dashboard" });
  }
};


