// routes/obsequioRoutes.js
const express = require("express");
const router = express.Router();
const Obsequio = require("../models/Obsequio");

// --------------------- CONTROLADORES ---------------------

// Listar todos los obsequios
router.get("/", async (req, res) => {
  try {
    const obsequios = await Obsequio.findAll();
    res.json(obsequios);
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: "Error al obtener los obsequios." });
  }
});

// Obtener un obsequio por ID
router.get("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const obsequio = await Obsequio.findByPk(id);

    if (!obsequio) {
      return res.status(404).json({ mensaje: "Obsequio no encontrado." });
    }

    res.json(obsequio);
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: "Error al obtener el obsequio." });
  }
});

// Crear un nuevo obsequio
router.post("/", async (req, res) => {
  const { nombre, costoReferencial, activo } = req.body;

  try {
    const nuevoObsequio = await Obsequio.create({
      nombre,
      costoReferencial,
      activo,
    });

    res.status(201).json(nuevoObsequio);
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: "Error al crear el obsequio." });
  }
});

// Actualizar un obsequio
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const { nombre, costoReferencial, activo } = req.body;

  try {
    const obsequio = await Obsequio.findByPk(id);
    if (!obsequio) {
      return res.status(404).json({ mensaje: "Obsequio no encontrado." });
    }

    await obsequio.update({
      nombre,
      costoReferencial,
      activo,
    });

    res.json(obsequio);
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: "Error al actualizar el obsequio." });
  }
});

// Eliminar un obsequio
router.delete("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const obsequio = await Obsequio.findByPk(id);
    if (!obsequio) {
      return res.status(404).json({ mensaje: "Obsequio no encontrado." });
    }

    await obsequio.destroy();
    res.json({ mensaje: "Obsequio eliminado correctamente." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: "Error al eliminar el obsequio." });
  }
});

module.exports = router;
