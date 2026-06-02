const express = require("express");
const Rol = require("../models/Rol");

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const { nombre, descripcion, activo } = req.body;
    const existing = await Rol.findOne({ where: { nombre } });
    if (existing) return res.status(400).json({ message: "El rol ya existe." });
    const nuevo = await Rol.create({ nombre, descripcion, activo: activo ?? true });
    return res.status(201).json(nuevo);
  } catch (error) {
    return res.status(500).json({ message: "Error al crear el rol", error });
  }
});

router.get("/", async (_req, res) => {
  try {
    const roles = await Rol.findAll({ order: [["nombre", "ASC"]] });
    return res.json(roles);
  } catch (error) {
    return res.status(500).json({ message: "Error al obtener roles", error });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const rol = await Rol.findByPk(req.params.id);
    if (!rol) return res.status(404).json({ message: "Rol no encontrado" });
    const { nombre, descripcion, activo } = req.body;
    rol.nombre = nombre ?? rol.nombre;
    rol.descripcion = descripcion ?? rol.descripcion;
    rol.activo = activo ?? rol.activo;
    await rol.save();
    return res.json(rol);
  } catch (error) {
    return res.status(500).json({ message: "Error al actualizar rol", error });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const rol = await Rol.findByPk(req.params.id);
    if (!rol) return res.status(404).json({ message: "Rol no encontrado" });
    await rol.destroy();
    return res.json({ message: "Rol eliminado correctamente" });
  } catch (error) {
    return res.status(500).json({ message: "Error al eliminar rol", error });
  }
});

module.exports = router;

