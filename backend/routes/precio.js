// routes/dispositivoMarcaRoutes.js
const express = require("express");
const router = express.Router();
const { Op } = require("sequelize");
const CostoHistorico = require("../models/CostoHistorico"); // tu modelo de precios

// Ruta para obtener precio según modelo y forma de pago
router.get("/:modeloId/", async (req, res) => {
  try {
    const modeloId = parseInt(req.params.modeloId, 10);
    if (isNaN(modeloId)) {
      return res.status(400).json({ message: "ID de modelo o forma de pago inválido" });
    }

    // Buscar precio
    const costo = await CostoHistorico.findOne({
      where: {
        modeloId,
      }
    });

    if (!costo) {
      return res.status(404).json({ message: "No se encontró precio para este modelo y forma de pago" });
    }

    res.json({ modeloId, precio: costo.precio });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al obtener precio" });
  }
});

module.exports = router;
