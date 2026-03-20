const express = require("express");
const router = express.Router();
const CostoHistorico = require("../models/CostoHistorico");
const Modelo = require("../models/Modelo");

router.get("/", async (req, res) => {
  try {
    const costos = await CostoHistorico.findAll({
      include: [
        { model: Modelo, as: "modelo" },
      ]
    });
    res.json(costos);  
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const costo = await CostoHistorico.findByPk(req.params.id, {
      include: [
        { model: Modelo, as: "modelo" },
      ]
    });
    if (!costo) return res.status(404).json({ message: "No encontrado" });
    res.json(costo);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


router.post("/", async (req, res) => {
  try {
    let { modeloId, costo, fechaCompra, proveedor, nota } = req.body;

    // =========================
    // ✅ VALIDACIONES BÁSICAS
    // =========================
    if (!modeloId || !costo || !fechaCompra) {
      return res.status(400).json({
        message: "modeloId, costo y fechaCompra son obligatorios",
      });
    }

    // =========================
    // ✅ VALIDAR FORMATO FECHA (DATEONLY)
    // =========================
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaCompra)) {
      return res.status(400).json({
        message: "Formato de fecha inválido (YYYY-MM-DD)",
      });
    }

    // =========================
    // ✅ NORMALIZAR COSTO
    // =========================
    if (typeof costo === "string") {
      costo = costo.replace(",", ".");
    }

    const costoNum = parseFloat(costo);

    if (isNaN(costoNum)) {
      return res.status(400).json({ message: "Costo inválido" });
    }

    // ❌ No permitir 0 o negativos
    if (costoNum <= 0) {
      return res.status(400).json({
        message: "El costo debe ser mayor a 0",
      });
    }

    // ❌ Máximo 2 decimales
    const decimalPart = costoNum.toString().split(".")[1];
    if (decimalPart && decimalPart.length > 2) {
      return res.status(400).json({
        message: "El costo solo puede tener hasta 2 decimales",
      });
    }

    // =========================
    // ✅ VALIDAR MODELO EXISTE
    // =========================
    const modelo = await Modelo.findByPk(modeloId);
    if (!modelo) {
      return res.status(404).json({
        message: "Modelo no existe",
      });
    }

    // =========================
    // ✅ EVITAR DUPLICADOS
    // =========================
    const existe = await CostoHistorico.findOne({
      where: {
        modeloId,
        fechaCompra, // DATEONLY → comparación directa
      },
    });

    if (existe) {
      return res.status(400).json({
        message: "Ya existe un costo para este modelo en esa fecha",
      });
    }

    // =========================
    // ✅ CREAR REGISTRO
    // =========================
    const nuevoCosto = await CostoHistorico.create({
      modeloId,
      costo: costoNum,
      fechaCompra,
      proveedor: proveedor?.trim() || null,
      nota: nota?.trim() || null,
    });

    return res.status(201).json(nuevoCosto);

  } catch (error) {
    console.error("Error al crear costo:", error);

    return res.status(500).json({
      message: "Error interno del servidor",
      error: error.message,
    });
  }
});


router.put("/:id", async (req, res) => {
  try {
    const costo = await CostoHistorico.findByPk(req.params.id);
    if (!costo) return res.status(404).json({ message: "No encontrado" });
    await costo.update(req.body);
    res.json(costo);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const costo = await CostoHistorico.findByPk(req.params.id);
    if (!costo) return res.status(404).json({ message: "No encontrado" });
    await costo.destroy();
    res.json({ message: "Eliminado correctamente" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
