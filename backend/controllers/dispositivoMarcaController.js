// controllers/dispositivoMarcaController.js
const { sequelize } = require("../config/db");
const Dispositivo = require("../models/Dispositivo");
const DispositivoMarca = require("../models/DispositivoMarca");
const Marca = require("../models/Marca");
const Modelo = require("../models/Modelo");

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
    const soloActivos = String(req.query.soloActivos || "").toLowerCase() === "true";

    const relaciones = await DispositivoMarca.findAll({
      ...(soloActivos && { where: { activo: true } }),
      include: [
        {
          model: Dispositivo,
          as: "dispositivo",
          attributes: ["id", "nombre", "activo"],
          ...(soloActivos && { where: { activo: true }, required: true }),
        },
        {
          model: Marca,
          as: "marca",
          attributes: ["id", "nombre", "activo"],
          ...(soloActivos && { where: { activo: true }, required: true }),
        },
      ],
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

    const resultado = await sequelize.transaction(async (transaction) => {
      const relacion = await DispositivoMarca.findByPk(id, { transaction });
      if (!relacion) return null;

      relacion.activo = activo ?? relacion.activo;
      await relacion.save({ transaction });

      let modelosDesactivados = 0;
      if (relacion.activo === false) {
        [modelosDesactivados] = await Modelo.update(
          { activo: false },
          {
            where: { dispositivoMarcaId: relacion.id, activo: true },
            transaction,
          },
        );
      }

      return { relacion, modelosDesactivados };
    });

    if (!resultado) {
      return res.status(404).json({ message: "Relación no encontrada" });
    }

    const relacionPayload =
      typeof resultado.relacion.toJSON === "function"
        ? resultado.relacion.toJSON()
        : resultado.relacion;
    res.json({
      ...relacionPayload,
      modelosDesactivados: resultado.modelosDesactivados,
    });
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
