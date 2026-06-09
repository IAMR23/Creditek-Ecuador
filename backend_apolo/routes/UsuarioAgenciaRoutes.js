const express = require("express");
const UsuarioAgencia = require("../models/UsuarioAgencia");
const Usuario = require("../models/Usuario");
const Agencia = require("../models/Agencia");

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const { usuarioId, agenciaId, activo } = req.body;

    const usuario = await Usuario.findByPk(usuarioId);
    if (!usuario) return res.status(400).json({ message: "Usuario no encontrado" });
    if (!usuario.activo) {
      return res.status(400).json({ message: "No se puede asignar un usuario inactivo." });
    }

    const agencia = await Agencia.findByPk(agenciaId);
    if (!agencia) return res.status(400).json({ message: "Agencia no encontrada" });

    const existing = await UsuarioAgencia.findOne({ where: { usuarioId, agenciaId } });
    if (existing)
      return res.status(400).json({ message: "El usuario ya está asignado a esta agencia" });

    const relacion = await UsuarioAgencia.create({
      usuarioId,
      agenciaId,
      activo: activo ?? true,
    });

    return res.status(201).json(relacion);
  } catch (error) {
    return res.status(500).json({ message: "Error al asignar usuario a agencia", error });
  }
});

router.get("/", async (_req, res) => {
  try {
    const relaciones = await UsuarioAgencia.findAll({
      include: [
        { model: Usuario, as: "usuario" },
        { model: Agencia, as: "agencia" },
      ],
      order: [["id", "ASC"]],
    });
    return res.json(relaciones);
  } catch (error) {
    return res.status(500).json({ message: "Error al obtener relaciones", error });
  }
});

router.get("/activos", async (_req, res) => {
  try {
    const relaciones = await UsuarioAgencia.findAll({
      where: { activo: true },
      include: [
        { model: Usuario, as: "usuario", where: { activo: true } },
        { model: Agencia, as: "agencia", where: { activo: true } },
      ],
      order: [["id", "ASC"]],
    });
    return res.json(relaciones);
  } catch (error) {
    return res.status(500).json({ message: "Error al obtener relaciones activas", error });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const relacion = await UsuarioAgencia.findByPk(req.params.id);
    if (!relacion) return res.status(404).json({ message: "Relación no encontrada" });
    const { activo } = req.body;
    relacion.activo = activo ?? relacion.activo;
    await relacion.save();
    return res.json(relacion);
  } catch (error) {
    return res.status(500).json({ message: "Error al actualizar relación", error });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const relacion = await UsuarioAgencia.findByPk(req.params.id);
    if (!relacion) return res.status(404).json({ message: "Relación no encontrada" });
    await relacion.destroy();
    return res.json({ message: "Relación eliminada correctamente" });
  } catch (error) {
    return res.status(500).json({ message: "Error al eliminar relación", error });
  }
});

module.exports = router;
