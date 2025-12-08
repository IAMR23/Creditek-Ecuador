const Venta = require("../models/Venta.js");
const UsuarioAgencia = require("../models/UsuarioAgencia");
const Usuario = require("../models/Usuario");
const Agencia = require("../models/Agencia");
const { Op } = require("sequelize");

exports.validarVenta = async (req, res) => {
  try {
    const { id } = req.params;
    const venta = await Venta.findByPk(id);

    if (!venta) {
      return res.status(404).json({ message: "Venta no encontrada" });
    }

    // si viene foto
    const fotoUrl = req.file ? `/uploads/ventas/${req.file.filename}` : null;

    await venta.update({
      validada: true,
      fotoValidacion: fotoUrl,
    });

    res.json({
      message: "Venta validada correctamente",
      venta,
    });
  } catch (error) {
    console.log("Error validando venta:", error);
    res.status(500).json({
      message: "Error al validar la venta",
    });
  }
};


exports.getVentasPorUsuarioAgencia = async (req, res) => {
  try {
    const { usuarioAgenciaId } = req.params;

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const manana = new Date(hoy);
    manana.setDate(manana.getDate() + 1);

    const ventas = await Venta.findAll({
      where: {
        usuarioAgenciaId,
        createdAt: {
          [Op.gte]: hoy,
          [Op.lt]: manana,
        },
      },
      attributes: [
        "id",
        "origenId",
        "createdAt",
        "validada",
        "fotoValidacion"   
      ],
      include: [
        {
          model: UsuarioAgencia,
          as: "usuarioAgencia",
          attributes: ["id"],
          include: [
            { model: Usuario, as: "usuario", attributes: ["nombre"] },
            { model: Agencia, as: "agencia", attributes: ["nombre"] },
          ],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    res.json({
      ok: true,
      total: ventas.length,
      ventas,
    });
  } catch (error) {
    console.error("Error getVentasPorUsuarioAgencia:", error);
    res.status(500).json({
      ok: false,
      msg: "Error al obtener las ventas del vendedor",
    });
  }
};
