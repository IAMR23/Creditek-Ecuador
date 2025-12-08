const express = require("express");
const router = express.Router();
const CostoHistorico = require("../models/CostoHistorico");
const Modelo = require("../models/Modelo");
const FormaPago = require("../models/FormaPago");

router.get("/", async (req, res) => {
  try {
    const costos = await CostoHistorico.findAll({
      include: [
        { model: Modelo, as: "modelo" },
        { model: FormaPago, as: "formaPago" }
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
        { model: FormaPago, as: "formaPago" }
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
    console.log("req.body", req.body);  
    const nuevoCosto = await CostoHistorico.create({
      ...req.body
    });
    res.status(201).json(nuevoCosto);
  } catch (error) {
    console.log("error", error);  
    res.status(500).json({ error: error.message });
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
