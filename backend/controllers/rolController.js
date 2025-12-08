// controllers/rolController.js
const Rol = require('../models/Rol');

// Listar todos los roles
const obtenerRoles = async (req, res) => {
  try {
    const roles = await Rol.findAll();
    res.json(roles);
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: 'Error al obtener los roles' });
  }
};

// Obtener un rol por ID
const obtenerRolPorId = async (req, res) => {
  const { id } = req.params;
  try {
    const rol = await Rol.findByPk(id);
    if (!rol) {
      return res.status(404).json({ msg: 'Rol no encontrado' });
    }
    res.json(rol);
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: 'Error al obtener el rol' });
  }
};

// Crear un nuevo rol
const crearRol = async (req, res) => {
  const { nombre, descripcion, activo } = req.body;
  try {
    const rol = await Rol.create({ nombre, descripcion, activo });
    res.status(201).json(rol);
  } catch (error) {
    console.error(error);
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ msg: 'El nombre del rol ya existe' });
    }
    res.status(500).json({ msg: 'Error al crear el rol' });
  }
};

// Actualizar un rol
const actualizarRol = async (req, res) => {
  const { id } = req.params;
  const { nombre, descripcion, activo } = req.body;
  try {
    const rol = await Rol.findByPk(id);
    if (!rol) {
      return res.status(404).json({ msg: 'Rol no encontrado' });
    }

    await rol.update({ nombre, descripcion, activo });
    res.json(rol);
  } catch (error) {
    console.error(error);
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ msg: 'El nombre del rol ya existe' });
    }
    res.status(500).json({ msg: 'Error al actualizar el rol' });
  }
};

// Eliminar un rol (soft delete)
const eliminarRol = async (req, res) => {
  const { id } = req.params;
  try {
    const rol = await Rol.findByPk(id);
    if (!rol) {
      return res.status(404).json({ msg: 'Rol no encontrado' });
    }

    // Soft delete
    await rol.update({ activo: false });
    res.json({ msg: 'Rol desactivado correctamente' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: 'Error al eliminar el rol' });
  }
};

// ✅ Exportar todas las funciones
module.exports = {
  obtenerRoles,
  obtenerRolPorId,
  crearRol,
  actualizarRol,
  eliminarRol
};
