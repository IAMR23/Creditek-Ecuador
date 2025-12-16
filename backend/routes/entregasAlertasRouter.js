const express = require("express");
const Entrega = require("../models/Entrega");
const { Op } = require("sequelize");
const {
  calcularEstadoEntrega,
} = require("../controllers/Logistica/calculoEntregas");
const UsuarioAgencia = require("../models/UsuarioAgencia");
const Cliente = require("../models/Cliente");

const router = express.Router();
router.get("/entregas-pendientes", async (req, res) => {
  try {
    const entregas = await Entrega.findAll({
      where: {
        estado: "Pendiente",
        //    FechaHoraLlamada: { [Op.ne]: null },
      },
      attributes: ["id", "FechaHoraLlamada", "observacion"],
      include: [
        {
          model: Cliente,
          as: "cliente",
          attributes: ["id", "cliente", "telefono"],
        },
      ],
    });

    const alertas = entregas.map((entrega) => {
      const calculo = calcularEstadoEntrega(entrega.FechaHoraLlamada);
      return {
        id: entrega.id,
        estado: calculo.estado,
        horasRestantes: calculo.horasRestantes,
        minutosRestantes: calculo.minutosRestantes,
        FechaHoraLlamada: entrega.FechaHoraLlamada,
        fechaLimite: calculo.fechaLimite,
        observacion: entrega.observacion,
        cliente: {
          nombre: entrega.cliente?.cliente,
          telefono: entrega.cliente?.telefono,
          cedula: entrega.cliente?.cedula,
        },
      };
    });

    res.json(alertas);
  } catch (error) {
    console.error("Error ventas-alertas:", error);
    res.status(500).json({ ok: false });
  }
});

router.get("/entregas-transito", async (req, res) => {
  try {
    const entregas = await Entrega.findAll({
      where: {
        estado: "Transito",
        FechaHoraLlamada: { [Op.ne]: null },
      },
      attributes: ["id", "FechaHoraLlamada", "estado"],
    });
    const alertas = entregas.map((entrega) => {
      const calculo = calcularEstadoEntrega(entrega.FechaHoraLlamada);

      return {
        id: entrega.id,
        estado: entrega.estado,
        horasRestantes: calculo.horasRestantes,
        minutosRestantes: calculo.minutosRestantes,
        FechaHoraLlamada: entrega.FechaHoraLlamada,
        fechaLimite: calculo.fechaLimite,
        observacion: entrega.observacion,
      };
    });

    res.json(alertas);
  } catch (error) {
    console.error("Error ventas-alertas:", error);
    res.status(500).json({ ok: false });
  }
});

module.exports = router;
