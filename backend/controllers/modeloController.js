// controllers/modeloController.js
const Modelo = require("../models/Modelo");
const Marca = require("../models/Marca");

exports.crearModelo = async (req, res) => {
  try {
    const { nombre, descripcion, activo, marcaId } = req.body;

    // Validar que la marca exista
    const marcaExistente = await Marca.findByPk(marcaId);
    if (!marcaExistente) {
      return res.status(400).json({ message: "La marca especificada no existe." });
    }

    const nuevoModelo = await Modelo.create({
      nombre,
      descripcion,
      activo: activo ?? true,
      marcaId,
    });

    res.status(201).json(nuevoModelo);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al crear el modelo", error });
  }
};

// Listar todos los modelos
exports.listarModelos = async (req, res) => {
  try {
    const modelos = await Modelo.findAll({
      include: { model: Marca, as: "marca" },
    });
    res.json(modelos);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al obtener los modelos", error });
  }
};

// Obtener modelo por ID
exports.obtenerModelo = async (req, res) => {
  try {
    const { id } = req.params;
    const modelo = await Modelo.findByPk(id, {
      include: { model: Marca, as: "marca" },
    });

    if (!modelo) {
      return res.status(404).json({ message: "Modelo no encontrado" });
    }

    res.json(modelo);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al obtener el modelo", error });
  }
};

// Actualizar modelo
exports.actualizarModelo = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, descripcion, activo, marcaId } = req.body;

    const modeloExistente = await Modelo.findByPk(id);
    if (!modeloExistente) {
      return res.status(404).json({ message: "Modelo no encontrado" });
    }

    // Validar marca si se envía
    if (marcaId) {
      const marcaExistente = await Marca.findByPk(marcaId);
      if (!marcaExistente) {
        return res.status(400).json({ message: "La marca especificada no existe." });
      }
      modeloExistente.marcaId = marcaId;
    }

    modeloExistente.nombre = nombre ?? modeloExistente.nombre;
    modeloExistente.descripcion = descripcion ?? modeloExistente.descripcion;
    modeloExistente.activo = activo ?? modeloExistente.activo;

    await modeloExistente.save();
    res.json(modeloExistente);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al actualizar el modelo", error });
  }
};

// Eliminar modelo
exports.eliminarModelo = async (req, res) => {
  try {
    const { id } = req.params;
    const modeloExistente = await Modelo.findByPk(id);

    if (!modeloExistente) {
      return res.status(404).json({ message: "Modelo no encontrado" });
    }

    await modeloExistente.destroy();
    res.json({ message: "Modelo eliminado correctamente" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al eliminar el modelo", error });
  }
};
