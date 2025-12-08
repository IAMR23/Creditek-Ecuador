// controllers/dispositivoMarcaController.js
const Dispositivo = require("../models/Dispositivo");
const DispositivoMarca = require("../models/DispositivoMarca");
const Marca = require("../models/Marca");

// Crear relación dispositivo-marca
exports.crearDispositivoMarca = async (req, res) => {
  try {
    const { dispositivoId, marcaId, activo } = req.body;

    // Verificar si ya existe la relación
    const existing = await DispositivoMarca.findOne({ 
      where: { dispositivoId, marcaId } 
    });
    if (existing) {
      return res.status(400).json({ message: "La relación dispositivo-marca ya existe." });
    }

    const nuevaRelacion = await DispositivoMarca.create({
      dispositivoId,
      marcaId,
      activo: activo ?? true,
    });

    res.status(201).json(nuevaRelacion);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al crear la relación", error });
  }
};

exports.listarDispositivoMarca = async (req, res) => {
  try {
    const relaciones = await DispositivoMarca.findAll({
      include: [
        {
          model: Dispositivo,
          as: "dispositivo",
          attributes: ["id", "nombre", "activo"]
        },
        {
          model: Marca,
          as: "marca",
          attributes: ["id", "nombre", "activo"]
        }
      ]
    });

    res.json(relaciones);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al obtener relaciones", error });
  }
};


// Obtener relación por ID
exports.obtenerDispositivoMarca = async (req, res) => {
  try {
    const { id } = req.params;
    const relacion = await DispositivoMarca.findByPk(id);
    if (!relacion) return res.status(404).json({ message: "Relación no encontrada" });
    res.json(relacion);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al obtener relación", error });
  }
};

// Actualizar relación
exports.actualizarDispositivoMarca = async (req, res) => {
  try {
    const { id } = req.params;
    const { activo } = req.body;

    const relacion = await DispositivoMarca.findByPk(id);
    if (!relacion) return res.status(404).json({ message: "Relación no encontrada" });

    relacion.activo = activo ?? relacion.activo;
    await relacion.save();

    res.json(relacion);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al actualizar relación", error });
  }
};

// Eliminar relación
exports.eliminarDispositivoMarca = async (req, res) => {
  try {
    const { id } = req.params;
    const relacion = await DispositivoMarca.findByPk(id);
    if (!relacion) return res.status(404).json({ message: "Relación no encontrada" });

    await relacion.destroy();
    res.json({ message: "Relación eliminada correctamente" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al eliminar relación", error });
  }
};
