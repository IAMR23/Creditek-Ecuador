// controllers/marcaController.js
const Marca = require("../models/Marca");

// Crear marca
exports.crearMarca = async (req, res) => {
  try {
    const { nombre, activo } = req.body;

    // Verificar si la marca ya existe
    const existing = await Marca.findOne({ where: { nombre } });
    if (existing) {
      return res.status(400).json({ message: "La marca ya existe." });
    }

    const nuevaMarca = await Marca.create({
      nombre,
      activo: activo ?? true,
    });

    res.status(201).json(nuevaMarca);
  } catch (error) {
    console.error("Error al crear marca:", error);
    res.status(500).json({ message: "Error al crear la marca", error });
  }
};

// Listar todas las marcas
exports.listarMarcas = async (req, res) => {
  try {
    const marcas = await Marca.findAll();
    res.json(marcas);
  } catch (error) {
    console.error("Error al listar marcas:", error);
    res.status(500).json({ message: "Error al listar marcas", error });
  }
};

// Obtener marca por ID
exports.obtenerMarca = async (req, res) => {
  try {
    const { id } = req.params;
    const marca = await Marca.findByPk(id);

    if (!marca) {
      return res.status(404).json({ message: "Marca no encontrada" });
    }

    res.json(marca);
  } catch (error) {
    console.error("Error al obtener marca:", error);
    res.status(500).json({ message: "Error al obtener marca", error });
  }
};

// Actualizar marca
exports.actualizarMarca = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, activo } = req.body;

    const marca = await Marca.findByPk(id);
    if (!marca) {
      return res.status(404).json({ message: "Marca no encontrada" });
    }

    marca.nombre = nombre ?? marca.nombre;
    marca.activo = activo ?? marca.activo;

    await marca.save();
    res.json(marca);
  } catch (error) {
    console.error("Error al actualizar marca:", error);
    res.status(500).json({ message: "Error al actualizar marca", error });
  }
};

// Eliminar marca
exports.eliminarMarca = async (req, res) => {
  try {
    const { id } = req.params;

    const marca = await Marca.findByPk(id);
    if (!marca) {
      return res.status(404).json({ message: "Marca no encontrada" });
    }

    await marca.destroy();
    res.json({ message: "Marca eliminada correctamente" });
  } catch (error) {
    console.error("Error al eliminar marca:", error);
    res.status(500).json({ message: "Error al eliminar marca", error });
  }
};
