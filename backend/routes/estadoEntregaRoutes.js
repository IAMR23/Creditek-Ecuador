const express = require("express");
const router = express.Router();
const EstadoEntrega = require("../models/EstadoEntrega");

// =============================
// 📌 Crear un estado
// =============================
router.post("/", async (req, res) => {
  try {
    const { nombre } = req.body;

    if (!nombre) {
      return res.status(400).json({ message: "El nombre es obligatorio" });
    }

    const nuevoEstado = await EstadoEntrega.create({ nombre });
    res.status(201).json(nuevoEstado);

  } catch (error) {
    res.status(500).json({
      message: "Error al crear el estado",
      error: error.message
    });
  }
});

// =============================
// 📌 Obtener todos los estados
// =============================
router.get("/", async (req, res) => {
  try {
    const estados = await EstadoEntrega.findAll({ order: [["id", "ASC"]] });
    res.json(estados);

  } catch (error) {
    res.status(500).json({
      message: "Error al obtener los estados",
      error: error.message
    });
  }
});

// =============================
// 📌 Obtener un estado por ID
// =============================
router.get("/:id", async (req, res) => {
  try {
    const estado = await EstadoEntrega.findByPk(req.params.id);

    if (!estado) {
      return res.status(404).json({ message: "Estado no encontrado" });
    }

    res.json(estado);

  } catch (error) {
    res.status(500).json({
      message: "Error al obtener el estado",
      error: error.message
    });
  }
});

// =============================
// 📌 Actualizar un estado
// =============================
router.put("/:id", async (req, res) => {
  try {
    const { nombre } = req.body;
    const estado = await EstadoEntrega.findByPk(req.params.id);

    if (!estado) {
      return res.status(404).json({ message: "Estado no encontrado" });
    }

    estado.nombre = nombre ?? estado.nombre;
    await estado.save();

    res.json(estado);

  } catch (error) {
    res.status(500).json({
      message: "Error al actualizar el estado",
      error: error.message
    });
  }
});

// =============================
// 📌 Eliminar un estado
// =============================
router.delete("/:id", async (req, res) => {
  try {
    const estado = await EstadoEntrega.findByPk(req.params.id);

    if (!estado) {
      return res.status(404).json({ message: "Estado no encontrado" });
    }

    await estado.destroy();
    res.json({ message: "Estado eliminado correctamente" });

  } catch (error) {
    res.status(500).json({
      message: "Error al eliminar el estado",
      error: error.message
    });
  }
});

module.exports = router;
