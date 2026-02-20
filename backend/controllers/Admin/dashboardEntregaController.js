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
    // 📅 Fechas opcionales
    if (fechaInicio || fechaFin) {
      const rango = {};

      if (fechaInicio) {
        const inicio = new Date(fechaInicio);
        inicio.setHours(0, 0, 0, 0);
        rango[Op.gte] = inicio;
      }

      if (fechaFin) {
        const fin = new Date(fechaFin);
        fin.setHours(23, 59, 59, 999);
        rango[Op.lte] = fin;
      }

      whereBase.fecha = rango;
    }

    // 🔗 INCLUDE MOTORIZADO (clave)
    const includeMotorizado = {
      model: UsuarioAgenciaEntrega,
      as: "UsuarioAgenciaEntrega",
      attributes: [],
      required: !!userId, // INNER JOIN si hay filtro
      include: [
        {
          model: UsuarioAgencia,
          as: "usuarioAgencia",
          attributes: [],
          ...(userId && {
            where: { id: userId },
          }),
        },
      ],
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
