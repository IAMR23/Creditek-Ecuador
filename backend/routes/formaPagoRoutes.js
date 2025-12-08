// routes/formaPagoRoutes.js
const express = require("express");
const router = express.Router();
const FormaPago = require("../models/FormaPago");

// --------------------- CONTROLADORES ---------------------

// Listar todas las formas de pago
router.get("/", async (req, res) => {
  try {
    const formasPago = await FormaPago.findAll();
    res.json(formasPago);
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: "Error al obtener las formas de pago." });
  }
});

// Obtener una forma de pago por ID
router.get("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const formaPago = await FormaPago.findByPk(id);

    if (!formaPago) {
      return res.status(404).json({ mensaje: "Forma de pago no encontrada." });
    }

    res.json(formaPago);
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: "Error al obtener la forma de pago." });
  }
});

// Crear una nueva forma de pago
router.post("/", async (req, res) => {
  const { nombre, descripcion, activo } = req.body;

  try {
    const nuevaFormaPago = await FormaPago.create({
      nombre,
      descripcion,
      activo,
    });

    res.status(201).json(nuevaFormaPago);
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: "Error al crear la forma de pago." });
  }
});

// Actualizar una forma de pago
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const { nombre, descripcion, activo } = req.body;

  try {
    const formaPago = await FormaPago.findByPk(id);
    if (!formaPago) {
      return res.status(404).json({ mensaje: "Forma de pago no encontrada." });
    }

    await formaPago.update({
      nombre,
      descripcion,
      activo,
    });

    res.json(formaPago);
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: "Error al actualizar la forma de pago." });
  }
});

// Eliminar una forma de pago
router.delete("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const formaPago = await FormaPago.findByPk(id);
    if (!formaPago) {
      return res.status(404).json({ mensaje: "Forma de pago no encontrada." });
    }

    await formaPago.destroy();
    res.json({ mensaje: "Forma de pago eliminada correctamente." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: "Error al eliminar la forma de pago." });
  }
});

module.exports = router;
