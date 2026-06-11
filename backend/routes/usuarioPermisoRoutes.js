const express = require("express");
const router = express.Router();
const UsuarioPermiso = require("../models/UsuarioPermiso");
const UsuarioAgencia = require("../models/UsuarioAgencia");
const Permiso = require("../models/Permiso");
const Usuario = require("../models/Usuario");
const Agencia = require("../models/Agencia");
const Rol = require("../models/Rol");
const { authenticate, requirePermission } = require("../middleware/authMiddleware");

router.post("/", authenticate, requirePermission("Administracion"), async (req, res) => {
  try {
    const { usuarioId, permisoIds, fechaInicio, fechaFin } = req.body;

    if (!usuarioId) {
      return res.status(400).json({ message: "Debe enviar usuarioId" });
    }

    if (!Array.isArray(permisoIds)) {
      return res.status(400).json({ message: "Debe enviar permisoIds como arreglo" });
    }

    const usuario = await Usuario.findByPk(usuarioId);
    if (!usuario) {
      return res.status(404).json({ message: "Usuario no existe" });
    }

    const permisoIdsNormalizados = [...new Set(permisoIds.map(Number).filter(Boolean))];
    const permisosValidos = await Permiso.findAll({
      where: { id: permisoIdsNormalizados },
      attributes: ["id"],
    });
    const permisosValidosIds = permisosValidos.map((p) => p.id);

    await UsuarioPermiso.destroy({
      where: { usuarioId },
    });

    if (permisosValidosIds.length > 0) {
      await UsuarioPermiso.bulkCreate(
        permisosValidosIds.map((permisoId) => ({
          usuarioId,
          permisoId,
          fechaInicio,
          fechaFin,
          activo: true,
        })),
      );
    }

    const permisosConInfo = await UsuarioPermiso.findAll({
      where: { usuarioId },
      include: [
        { model: Usuario, as: "usuario", attributes: ["id", "nombre", "email"] },
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

router.get(
  "/usuarios-permisos",
  authenticate,
  requirePermission("Administracion"),
  async (req, res) => {
    try {
      const usuariosConPermisos = await Usuario.findAll({
        where: { activo: true },
        attributes: { exclude: ["password"] },
        include: [
          {
            model: Rol,
            as: "rol",
            attributes: ["id", "nombre"],
          },
          {
            model: UsuarioPermiso,
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
        order: [["nombre", "ASC"]],
      });

      res.json(usuariosConPermisos);
    } catch (error) {
      console.error(error);
      res.status(500).json({
        message: "Error al obtener usuarios con permisos",
        error,
      });
    }
  },
);

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
            {
              model: Rol,
              as: "roles",
              required: false,
              attributes: ["id", "nombre"],
              through: { attributes: [] },
            },
            {
              model: UsuarioPermiso,
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
        },
        {
          model: Agencia,
          as: "agencia",
          attributes: ["id", "nombre"],
        },
      ],
    });

    const repartidores = relaciones.filter((ua) => {
      const rolesUsuario = [
        ua.usuario?.rol,
        ...(ua.usuario?.roles || []),
      ].filter(Boolean);

      const tieneRol = rolesUsuario.some(
        (rol) => String(rol.nombre || "").trim().toLowerCase() === "repartidor",
      );
      const tienePermiso = ua.usuario?.permisosAsignados?.some(
        (p) => p.permiso?.nombre === "Logistica",
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
