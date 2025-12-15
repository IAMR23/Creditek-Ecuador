const Entrega = require("../models/Entrega.js");
const UsuarioAgencia = require("../models/UsuarioAgencia.js");
const Usuario = require("../models/Usuario.js");
const Agencia = require("../models/Agencia.js");
const { Op } = require("sequelize");

exports.fotoClienteRespaldo = async (req, res) => {
  try {
    const { id } = req.params;
    const entrega = await Entrega.findByPk(id);

    if (!entrega) {
      return res.status(404).json({ message: "Entrega no encontrada" });
    }

    const fotoUrl = req.file ? `/uploads/ventas/${req.file.filename}` : null;

    await entrega.update({ 
      validada: true,
      fotoValidacion: fotoUrl,
    });

    res.json({
      message: "Entrega validada correctamente",
      entrega,
    });
  } catch (error) {
    console.log("Error validando entrega:", error);
    res.status(500).json({
      message: "Error al validar la entrega",
    });
  }
};


exports.fotoFechaRespaldo = async (req, res) => {
  try {
    const { id } = req.params;
    const { FechaHoraLlamada } = req.body; // viene desde el frontend

    // Validar que sí envíen fecha y hora
    if (!FechaHoraLlamada) {
      return res.status(400).json({
        message: "La fecha y hora de la llamada es obligatoria.",
      });
    }

    const entrega = await Entrega.findByPk(id);

    if (!entrega) {
      return res.status(404).json({ message: "Entrega no encontrada" });
    }

    const fotoUrl = req.file ? `/uploads/ventas/${req.file.filename}` : null;

    await entrega.update({
      validada: true,
      fotoFechaLlamada: fotoUrl,
      FechaHoraLlamada, // guardamos fecha + hora
    });

    res.json({
      message: "Entrega validada correctamente",
      entrega,
    });
  } catch (error) {
    console.log("Error validando entrega:", error);
    res.status(500).json({
      message: "Error al validar la entrega",
    });
  }  
};

exports.fotoLogisticaRespaldo = async (req, res) => {
  try {
    const { id } = req.params;

    const entrega = await Entrega.findByPk(id);

    if (!entrega) {
      return res.status(404).json({ message: "Entrega no encontrada" });
    }

    const fotoUrl = req.file ? `/uploads/ventas/${req.file.filename}` : null;

    await entrega.update({
      validada: true,
      fotoLogistica: fotoUrl,
    });

    res.json({
      message: "Entrega validada correctamente",
      entrega,
    });
  } catch (error) {
    console.log("Error validando entrega:", error);
    res.status(500).json({
      message: "Error al validar la entrega",
    });
  }
};

exports.getEntregasPorUsuarioAgencia = async (req, res) => {
  try {
    const { usuarioAgenciaId } = req.params;

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const manana = new Date(hoy);
    manana.setDate(manana.getDate() + 1);

    const entregas = await Entrega.findAll({
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
      total: entregas.length,
      entregas,
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({
      ok: false,
      msg: "Error al obtener las entregas del vendedor",
    });
  }
};
