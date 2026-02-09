const express = require("express");
const router = express.Router();
const { sequelize } = require("../config/db");

const Traslado = require("../models/Traslado");
const DetalleTraslado = require("../models/DetalleTraslado");

router.post("/traslado", async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const {
      estado,
      usuario_agencia_id,
      agencia_destino_id,
      agencia_origen_id,
      detalles,
    } = req.body;

    // Validación básica
    if (!detalles || !Array.isArray(detalles) || detalles.length === 0) {
      return res.status(400).json({
        message: "Debe enviar al menos un detalle de traslado",
      });
    }

    // 1️⃣ Crear traslado
    const traslado = await Traslado.create(
      {
        estado,
        usuario_agencia_id,
        agencia_destino_id,
        agencia_origen_id,
      },
      { transaction: t }
    );

    // 2️⃣ Crear detalles
    const detallesConTrasladoId = detalles.map((item) => ({
      ...item,
      trasladoId: traslado.id,
    }));

    await DetalleTraslado.bulkCreate(detallesConTrasladoId, {
      transaction: t,
    });

    // 3️⃣ Confirmar
    await t.commit();

    return res.status(201).json({
      message: "Traslado creado correctamente",
      trasladoId: traslado.id,
    });
  } catch (error) {
    await t.rollback();

    console.error(error);
    return res.status(500).json({
      message: "Error al crear traslado",
      error: error.message,
    });
  }
});

module.exports = router;
