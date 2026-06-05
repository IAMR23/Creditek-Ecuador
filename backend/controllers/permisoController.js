const Permiso = require("../models/Permiso");
const UsuarioAgenciaPermiso = require("../models/UsuarioAgenciaPermiso");
const { Op } = require("sequelize");

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

exports.listarPermisos = async (req, res) => {
  try {
    const permisos = await Permiso.findAll({
      order: [["nombre", "ASC"]],
    });
    res.json(permisos);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error listando permisos" });
  }
};

exports.sincronizarPermisos = async (req, res) => {
  try {
    const { permisos = [] } = req.body;

    if (!Array.isArray(permisos)) {
      return res.status(400).json({ message: "permisos debe ser un arreglo" });
    }

    const permisosNormalizados = permisos
      .map((p) => ({
        nombre: String(p.nombre || p.permission || "").trim(),
        descripcion: p.descripcion || p.path || null,
      }))
      .filter((p) => p.nombre);

    for (const permiso of permisosNormalizados) {
      await Permiso.findOrCreate({
        where: { nombre: permiso.nombre },
        defaults: permiso,
      });
    }

    const nombresPermitidos = permisosNormalizados.map((p) => p.nombre);
    const permisosObsoletos = await Permiso.findAll({
      where: {
        nombre: { [Op.notIn]: nombresPermitidos },
        descripcion: { [Op.like]: "Acceso a /%" },
      },
      attributes: ["id"],
    });
    const permisoIdsObsoletos = permisosObsoletos.map((p) => p.id);

    if (permisoIdsObsoletos.length > 0) {
      await UsuarioAgenciaPermiso.destroy({
        where: { permisoId: permisoIdsObsoletos },
      });
      await Permiso.destroy({
        where: { id: permisoIdsObsoletos },
      });
    }

    const permisosActualizados = await Permiso.findAll({
      order: [["nombre", "ASC"]],
    });

    res.json(permisosActualizados);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error sincronizando permisos" });
  }
};
