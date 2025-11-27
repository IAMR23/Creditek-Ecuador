const express = require("express");
const router = express.Router();
const Marca = require("../models/Marca");
const Dispositivo = require("../models/Dispositivo");
const { default: axios } = require("axios");

const API_CONTIFICO = process.env.API_CONTIFICO 
const API_KEY = process.env.API_KEY 
// Crear marca
router.post("/", async (req, res) => {
  try {
    const { nombre, dispositivoId, activo } = req.body;

    // Verificar si el dispositivo existe
    const dispositivo = await Dispositivo.findByPk(dispositivoId);
    if (!dispositivo) {
      return res.status(400).json({ message: "Dispositivo no encontrado." });
    }

    // Verificar si la marca ya existe para el mismo dispositivo
    const existing = await Marca.findOne({ 
      where: { nombre, dispositivoId } 
    });
    if (existing) {
      return res.status(400).json({ message: "La marca ya existe para este dispositivo." });
    }

    const nuevaMarca = await Marca.create({
      nombre,
      dispositivoId,
      activo: activo ?? true,
    });

    res.status(201).json(nuevaMarca);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al crear marca", error });
  }
});

// Obtener todas las marcas

router.get("/", async (req, res) => {
  try {
    const response = await axios.get(`${API_CONTIFICO}/marca`, {
      headers: {
        Authorization: `${API_KEY}`,
      },
    });

    res.json(response.data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error obteniendo marcas" });
  }
});

// Obtener marca por ID
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const marca = await Marca.findByPk(id, { include: Dispositivo });

    if (!marca) {
      return res.status(404).json({ message: "Marca no encontrada" });
    }

    res.json(marca);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al obtener marca", error });
  }
});

router.get("/dispositivo/:dispositivoId", async (req, res) => {
  try {
    const { dispositivoId } = req.params;
    const marcas = await Marca.findAll({
      where: { dispositivoId },
      attributes: ["id", "nombre"],
    });
    res.json(marcas);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al obtener marcas" });
  }
});

// Actualizar marca
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, dispositivoId, activo } = req.body;

    const marca = await Marca.findByPk(id);
    if (!marca) {
      return res.status(404).json({ message: "Marca no encontrada" });
    }

    // Verificar si se quiere cambiar de dispositivo
    if (dispositivoId) {
      const dispositivo = await Dispositivo.findByPk(dispositivoId);
      if (!dispositivo) {
        return res.status(400).json({ message: "Dispositivo no encontrado." });
      }
      marca.dispositivoId = dispositivoId;
    }

    marca.nombre = nombre ?? marca.nombre;
    marca.activo = activo ?? marca.activo;

    await marca.save();
    res.json(marca);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al actualizar marca", error });
  }
});

// Eliminar marca
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const marca = await Marca.findByPk(id);

    if (!marca) {
      return res.status(404).json({ message: "Marca no encontrada" });
    }

    await marca.destroy();
    res.json({ message: "Marca eliminada correctamente" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al eliminar marca", error });
  }
});





module.exports = router;
