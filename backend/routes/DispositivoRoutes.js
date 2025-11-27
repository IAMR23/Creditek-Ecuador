const express = require("express");
const router = express.Router();
const Dispositivo = require("../models/Dispositivo");


router.post("/", async (req, res) => {
  try {
    const { nombre, activo } = req.body;

    // Verificar si el dispositivo ya existe
    const existing = await Dispositivo.findOne({ where: { nombre } });
    if (existing) {
      return res.status(400).json({ message: "El dispositivo ya existe." });
    }

    const nuevoDispositivo = await Dispositivo.create({
      nombre,
      activo: activo ?? true,
    });

    res.status(201).json(nuevoDispositivo);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al crear dispositivo", error });
  }
});

// Obtener todos los dispositivos
router.get("/", async (req, res) => {
  try {
    const dispositivos = await Dispositivo.findAll();
    res.json(dispositivos);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al obtener dispositivos", error });
  }
});

// Obtener dispositivo por ID
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const dispositivo = await Dispositivo.findByPk(id);

    if (!dispositivo) {
      return res.status(404).json({ message: "Dispositivo no encontrado" });
    }

    res.json(dispositivo);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al obtener dispositivo", error });
  }
});

// Actualizar dispositivo
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, activo } = req.body;

    const dispositivo = await Dispositivo.findByPk(id);
    if (!dispositivo) {
      return res.status(404).json({ message: "Dispositivo no encontrado" });
    }

    dispositivo.nombre = nombre ?? dispositivo.nombre;
    dispositivo.activo = activo ?? dispositivo.activo;

    await dispositivo.save();
    res.json(dispositivo);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al actualizar dispositivo", error });
  }
});

// Eliminar dispositivo
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const dispositivo = await Dispositivo.findByPk(id);

    if (!dispositivo) {
      return res.status(404).json({ message: "Dispositivo no encontrado" });
    }

    await dispositivo.destroy();
    res.json({ message: "Dispositivo eliminado correctamente" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al eliminar dispositivo", error });
  }
});

module.exports = router;
