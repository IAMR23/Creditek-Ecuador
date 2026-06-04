const express = require("express");
const router = express.Router();
const UsuarioAgenciaPermiso = require("../models/UsuarioAgenciaPermiso");
const UsuarioAgencia = require("../models/UsuarioAgencia");
const Permiso = require("../models/Permiso");
const Usuario = require("../models/Usuario");
const Agencia = require("../models/Agencia");
const Rol = require("../models/Rol");

router.post("/", async (req, res) => {
  try {
    const { usuarioAgenciaId, permisoIds, fechaInicio, fechaFin } = req.body;

    if (!usuarioAgenciaId) {
      return res.status(400).json({ message: "Debe enviar usuarioAgenciaId" });
    }

    if (!Array.isArray(permisoIds)) {
      return res.status(400).json({ message: "Debe enviar permisoIds como arreglo" });
    }

    const usuarioAgencia = await UsuarioAgencia.findByPk(usuarioAgenciaId);
    if (!usuarioAgencia) {
      return res.status(404).json({ message: "Usuario-agencia no existe" });
    }

    const permisoIdsNormalizados = [...new Set(permisoIds.map(Number).filter(Boolean))];
    const permisosValidos = await Permiso.findAll({
      where: { id: permisoIdsNormalizados },
      attributes: ["id"],
    });
    const permisosValidosIds = permisosValidos.map((p) => p.id);

    await UsuarioAgenciaPermiso.destroy({
      where: { usuarioAgenciaId },
    });

    if (permisosValidosIds.length > 0) {
      await UsuarioAgenciaPermiso.bulkCreate(
        permisosValidosIds.map((permisoId) => ({
          usuarioAgenciaId,
          permisoId,
          fechaInicio,
          fechaFin,
          activo: true,
        })),
      );
    }

    const permisosConInfo = await UsuarioAgenciaPermiso.findAll({
      where: { usuarioAgenciaId },
      include: [
        { model: UsuarioAgencia, as: "usuarioAgencia" },
        { model: Permiso, as: "permiso" },
      ],
    });

    res.json({
      message: "Permisos actualizados correctamente",
      permisos: permisosConInfo,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error actualizando permisos asignados" });
  }
});

router.get("/usuarios-permisos", async (req, res) => {
  try {
    const usuariosConPermisos = await UsuarioAgencia.findAll({
      where: { activo: true },
      include: [
        {
          model: Usuario,
          as: "usuario",
        },
        {
          model: Agencia,
          as: "agencia",
        },
        {
          model: UsuarioAgenciaPermiso,
          as: "permisosAsignados",
          where: { activo: true },
          required: false,
          include: [
            {
              model: Permiso,
              as: "permiso",
            },
          ],
        },
      ],
      order: [["id", "ASC"]],
    });

    res.json(usuariosConPermisos);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Error al obtener usuarios con permisos",
      error,
    });
  }
});

router.get("/usuarios-repartidores", async (req, res) => {
  try {
    const relaciones = await UsuarioAgencia.findAll({
      where: { activo: true },
      include: [
        {
          model: Usuario,
          as: "usuario",
          where: { activo: true },
          attributes: ["id", "nombre", "email"],
          include: [
            {
              model: Rol,
              as: "rol",
              required: false,
              attributes: ["id", "nombre"],
            },
          ],
        },
        {
          model: Agencia,
          as: "agencia",
          attributes: ["id", "nombre"],
        },
        {
          model: UsuarioAgenciaPermiso,
          as: "permisosAsignados",
          required: false,
          include: [
            {
              model: Permiso,
              as: "permiso",
              attributes: ["id", "nombre"],
            },
          ],
        },
      ],
    });

    const repartidores = relaciones.filter((ua) => {
      const tieneRol = ua.usuario?.rol?.nombre === "Repartidor";
      const tienePermiso = ua.permisosAsignados?.some(
        (p) => p.permiso?.nombre === "Repartir",
      );

      return tieneRol || tienePermiso;
    });

    res.json(repartidores);
  } catch (error) {
    console.error("Error obteniendo repartidores:", error);
    res.status(500).json({ message: "Error al obtener repartidores" });
  }
});

module.exports = router;
