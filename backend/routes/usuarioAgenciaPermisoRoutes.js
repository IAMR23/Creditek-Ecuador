const express = require("express");
const router = express.Router();
const permisoController = require("../controllers/permisoController");
const UsuarioAgenciaPermiso = require("../models/UsuarioAgenciaPermiso");
const UsuarioAgencia = require("../models/UsuarioAgencia");
const Permiso = require("../models/Permiso");
const Usuario = require("../models/Usuario");
const Agencia = require("../models/Agencia");
const Rol = require("../models/Rol");

router.post("/", async (req, res) => {
  try {
    const { usuarioAgenciaId, permisoIds, fechaInicio, fechaFin } = req.body;

    if (!Array.isArray(permisoIds) || permisoIds.length === 0) {
      return res.status(400).json({ message: "Debe enviar al menos un permiso" });
    }

    // Filtrar permisos que ya existen
    const existentes = await UsuarioAgenciaPermiso.findAll({
      where: { 
        usuarioAgenciaId,
        permisoId: permisoIds
      }
    });

    const existentesIds = existentes.map(e => e.permisoId);

    const permisosNuevos = permisoIds.filter(id => !existentesIds.includes(id));

    if (permisosNuevos.length === 0) {
      return res.status(400).json({ message: "Los permisos ya están asignados" });
    }

    // Crear los permisos que no existían
    const nuevos = await Promise.all(
      permisosNuevos.map((permisoId) =>
        UsuarioAgenciaPermiso.create({
          usuarioAgenciaId,
          permisoId,
          fechaInicio,
          fechaFin,
        })
      )
    );

    const permisosConInfo = await UsuarioAgenciaPermiso.findAll({
      where: { id: nuevos.map((n) => n.id) },
      include: [
        { model: UsuarioAgencia, as: "usuarioAgencia" },
        { model: Permiso, as: "permiso" },
      ],
    });

    res.json(permisosConInfo);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error creando permisos asignados" });
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
          required: false, // ← importante: usuarios sin permisos igual salen
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
              required: false, // ⬅️ puede no tener rol repartidor
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
          required: false, // ⬅️ puede no tener permisos
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

    // 🧠 FILTRO OR REAL
    const repartidores = relaciones.filter((ua) => {
      const tieneRol =
        ua.usuario?.rol?.nombre === "Repartidor";

      const tienePermiso =
        ua.permisosAsignados?.some(
          (p) => p.permiso?.nombre === "Repartir"
        );

      return tieneRol || tienePermiso;
    });

    res.json(repartidores);
  } catch (error) {
    console.error("❌ Error obteniendo repartidores:", error);
    res.status(500).json({ message: "Error al obtener repartidores" });
  }
});



module.exports = router;
