const express = require("express");
const router = express.Router();
const permisoController = require("../controllers/permisoController");
const UsuarioAgenciaPermiso = require("../models/UsuarioAgenciaPermiso");
const UsuarioAgencia = require("../models/UsuarioAgencia");
const Permiso = require("../models/Permiso");

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

module.exports = router;
