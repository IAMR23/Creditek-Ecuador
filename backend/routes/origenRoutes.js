// routes/origenRoutes.js
const express = require("express");
const router = express.Router();
const Origen = require("../models/Origen");

// --------------------- CONTROLADORES ---------------------

// Listar todos los orígenes
router.get("/", async (req, res) => {
  try {
    const origenes = await Origen.findAll();
    res.json(origenes);
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: "Error al obtener los orígenes." });
  }
});

// Obtener un origen por ID
router.get("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const origen = await Origen.findByPk(id);

    if (!origen) {
      return res.status(404).json({ mensaje: "Origen no encontrado." });
    }

    res.json(origen);
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: "Error al obtener el origen." });
  }
});

// Crear un nuevo origen
router.post("/", async (req, res) => {
  const { nombre, descripcion, activo } = req.body;

  try {
    const nuevoOrigen = await Origen.create({
      nombre,
      descripcion,
      activo,
    });

    res.status(201).json(nuevoOrigen);
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: "Error al crear el origen." });
  }
});

// Actualizar un origen
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const { nombre, descripcion, activo } = req.body;

  try {
    const origen = await Origen.findByPk(id);
    if (!origen) {
      return res.status(404).json({ mensaje: "Origen no encontrado." });
    }

    await origen.update({
      nombre,
      descripcion,
      activo,
    });

    res.json(origen);
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: "Error al actualizar el origen." });
  }
});

// Eliminar un origen
router.delete("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const origen = await Origen.findByPk(id);
    if (!origen) {
      return res.status(404).json({ mensaje: "Origen no encontrado." });
    }

    await origen.destroy();
    res.json({ mensaje: "Origen eliminado correctamente." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: "Error al eliminar el origen." });
  }
});

module.exports = router;
