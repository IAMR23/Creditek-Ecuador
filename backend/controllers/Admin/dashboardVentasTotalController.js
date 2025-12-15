const { Op } = require("sequelize");
const Entrega = require("../../models/Entrega");
const Venta = require("../../models/Venta");

exports.getTotalVentas = async (req, res) => {
  try {
    let { fechaInicio, fechaFin } = req.query;

    // Validación por si no llegan fechas
    if (!fechaInicio || !fechaFin) {
      return res.status(400).json({
        message: "Debes enviar fechaInicio y fechaFin en el query params",
      });
    }

    // Asegurar formato correcto YYYY-MM-DD
    fechaInicio = new Date(fechaInicio);
    fechaFin = new Date(fechaFin);

    // Para incluir todo el día de fechaFin
    fechaFin.setHours(23, 59, 59, 999);

    const ventasDesdeEntregas = await Entrega.count({
      where: {
        estado: "Entregado",
        fecha: {
          [Op.between]: [fechaInicio, fechaFin],
        }
      }
    });

    const ventasDesdeVentas = await Venta.count({
      where: {
        validada: true,
        fecha: {
          [Op.between]: [fechaInicio, fechaFin],
        }
      }
    });

    const totalVentas = ventasDesdeEntregas + ventasDesdeVentas;

    return res.json({
      fechaInicio,
      fechaFin,
      ventasDesdeEntregas,
      ventasDesdeVentas,
      totalVentas,
    });

  } catch (error) {
    console.error("Error en getTotalVentas: ", error);
    res.status(500).json({ message: "Error en el servidor" });
  }
};
