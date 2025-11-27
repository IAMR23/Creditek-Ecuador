const express = require("express");
const router = express.Router();
const Agencia = require("../models/Agencia");

// ===========================
// 🔹 CONTROLADORES
// ===========================

// Crear agencia
router.post("/", async (req, res) => {
  try {
    const { nombre, direccion, telefono, ciudad, activo } = req.body;

    // Verificar si la agencia ya existe por nombre
    const existing = await Agencia.findOne({ where: { nombre } });
    if (existing) {
      return res.status(400).json({ message: "La agencia ya existe." });
    }

    const nuevaAgencia = await Agencia.create({
      nombre,
      direccion,
      telefono,
      ciudad,
      activo: activo ?? true,
    });

    res.status(201).json(nuevaAgencia);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al crear la agencia", error });
  }
});

// Obtener todas las agencias
router.get("/", async (req, res) => {
  try {
    const agencias = await Agencia.findAll();
    res.json(agencias);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al obtener agencias", error });
  }
});

// Obtener agencia por ID
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const agencia = await Agencia.findByPk(id);

    if (!agencia) {
      return res.status(404).json({ message: "Agencia no encontrada" });
    }

    res.json(agencia);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al obtener agencia", error });
  }
});

// Actualizar agencia
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, direccion, telefono, ciudad, activo } = req.body;

    const agencia = await Agencia.findByPk(id);
    if (!agencia) {
      return res.status(404).json({ message: "Agencia no encontrada" });
    }

    agencia.nombre = nombre ?? agencia.nombre;
    agencia.direccion = direccion ?? agencia.direccion;
    agencia.telefono = telefono ?? agencia.telefono;
    agencia.ciudad = ciudad ?? agencia.ciudad;
    agencia.activo = activo ?? agencia.activo;

    await agencia.save();
    res.json(agencia);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al actualizar agencia", error });
  }
});

// Eliminar agencia
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const agencia = await Agencia.findByPk(id);

    if (!agencia) {
      return res.status(404).json({ message: "Agencia no encontrada" });
    }

    await agencia.destroy();
    res.json({ message: "Agencia eliminada correctamente" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al eliminar agencia", error });
  }
});

module.exports = router;
