const express = require("express");
const router = express.Router(); 
const Modelo = require("../models/Modelo");
const Marca = require("../models/Marca");

// ===========================
// 🔹 CONTROLADORES
// ===========================

// Crear modelo
router.post("/", async (req, res) => {
  try {
    const { nombre, marcaId, activo } = req.body;

    // Verificar si la marca existe
    const marca = await Marca.findByPk(marcaId);
    if (!marca) {
      return res.status(400).json({ message: "Marca no encontrada." });
    }

    // Verificar si el modelo ya existe para la misma marca
    const existing = await Modelo.findOne({ where: { nombre, marcaId } });
    if (existing) {
      return res.status(400).json({ message: "El modelo ya existe para esta marca." });
    }

    const nuevoModelo = await Modelo.create({
      nombre,
      marcaId,
      activo: activo ?? true,
    });

    res.status(201).json(nuevoModelo);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al crear modelo", error });
  }
});

// Obtener todos los modelos
router.get("/", async (req, res) => {
  try {
    const modelos = await Modelo.findAll({ include: Marca });
    res.json(modelos);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al obtener modelos", error });
  }
});

// Obtener modelo por ID
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const modelo = await Modelo.findByPk(id, { include: Marca });

    if (!modelo) {
      return res.status(404).json({ message: "Modelo no encontrado" });
    }

    res.json(modelo);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al obtener modelo", error });
  }
});

// Actualizar modelo
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, marcaId, activo } = req.body;

    const modelo = await Modelo.findByPk(id);
    if (!modelo) {
      return res.status(404).json({ message: "Modelo no encontrado" });
    }

    // Verificar si se cambia de marca
    if (marcaId) {
      const marca = await Marca.findByPk(marcaId);
      if (!marca) {
        return res.status(400).json({ message: "Marca no encontrada." });
      }
      modelo.marcaId = marcaId;
    }

    modelo.nombre = nombre ?? modelo.nombre;
    modelo.activo = activo ?? modelo.activo;

    await modelo.save();
    res.json(modelo);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al actualizar modelo", error });
  }
});

// Eliminar modelo
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const modelo = await Modelo.findByPk(id);

    if (!modelo) {
      return res.status(404).json({ message: "Modelo no encontrado" });
    }

    await modelo.destroy();
    res.json({ message: "Modelo eliminado correctamente" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al eliminar modelo", error });
  }
});

router.get("/marca/:marcaId", async (req, res) => {
  try {
    const { marcaId } = req.params;
    const modelos = await Modelo.findAll({
      where: { marcaId },
      attributes: ["id", "nombre"],
    });
    res.json(modelos);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al obtener modelos" });
  }
});

module.exports = router;
