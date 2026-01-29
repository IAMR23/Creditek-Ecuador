const express = require("express");
const router = express.Router();
const UsuarioAgencia = require("../models/UsuarioAgencia");
const Usuario = require("../models/Usuario");
const Agencia = require("../models/Agencia");

// ===========================
// 🔹 CONTROLADORES
// ===========================

// Crear relación usuario-agencia
router.post("/", async (req, res) => {
  try {
    const { usuarioId, agenciaId, activo } = req.body;

    // Verificar si usuario y agencia existen
    const usuario = await Usuario.findByPk(usuarioId);
    if (!usuario) return res.status(400).json({ message: "Usuario no encontrado" });

    const agencia = await Agencia.findByPk(agenciaId);
    if (!agencia) return res.status(400).json({ message: "Agencia no encontrada" });

    // Verificar si la relación ya existe
    const existing = await UsuarioAgencia.findOne({ where: { usuarioId, agenciaId } });
    if (existing) return res.status(400).json({ message: "El usuario ya está asignado a esta agencia" });

    const relacion = await UsuarioAgencia.create({
      usuarioId,
      agenciaId,
      activo: activo ?? true,
    });

    res.status(201).json(relacion);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al asignar usuario a agencia", error });
  }
});

// Obtener todas las relaciones
router.get("/", async (req, res) => {
  try {
  const relaciones = await UsuarioAgencia.findAll({
  include: [
    { model: Usuario, as: "usuario" },
    { model: Agencia, as: "agencia" }
  ]
});

    res.json(relaciones);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al obtener relaciones", error });
  }
});


router.get("/activos", async (req, res) => {
  try {
    const relacionesActivas = await UsuarioAgencia.findAll({
      where: { activo: true }, // Solo activos
      include: [
        { model: Usuario, as: "usuario" },
        { model: Agencia, as: "agencia" },
      ],
      order: [
        ["id", "ASC"], // opcional, orden por id
      ],
    });

    res.json(relacionesActivas);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al obtener relaciones activas", error });
  }
});

// Obtener relación por ID
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const relacion = await UsuarioAgencia.findByPk(id, { include: [Usuario, Agencia] });

    if (!relacion) return res.status(404).json({ message: "Relación no encontrada" });

    res.json(relacion);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al obtener relación", error });
  }
});

// Actualizar relación
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const {  activo } = req.body;

    const relacion = await UsuarioAgencia.findByPk(id);
    if (!relacion) return res.status(404).json({ message: "Relación no encontrada" });

    relacion.activo = activo ?? relacion.activo;

    await relacion.save();
    res.json(relacion);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al actualizar relación", error });
  }
});

// Eliminar relación
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const relacion = await UsuarioAgencia.findByPk(id);
    if (!relacion) return res.status(404).json({ message: "Relación no encontrada" });

    await relacion.destroy();
    res.json({ message: "Relación eliminada correctamente" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al eliminar relación", error });
  }
});

module.exports = router;
