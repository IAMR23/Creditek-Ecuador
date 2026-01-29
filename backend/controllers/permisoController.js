const Permiso = require("../models/Permiso");

// Crear permiso en catálogo
exports.crearPermiso = async (req, res) => {
  try {
    const { nombre, descripcion } = req.body;
    const nuevoPermiso = await Permiso.create({ nombre, descripcion });
    res.status(201).json(nuevoPermiso);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error creando el permiso" });
  }
};

// Listar permisos del catálogo
exports.listarPermisos = async (req, res) => {
  try {
    const permisos = await Permiso.findAll();
    res.json(permisos);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error listando permisos" });
  }
};
