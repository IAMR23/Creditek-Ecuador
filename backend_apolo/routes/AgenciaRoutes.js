const express = require("express");
const Agencia = require("../models/Agencia");

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const { nombre, direccion, telefono, ciudad, activo } = req.body;
    const existing = await Agencia.findOne({ where: { nombre } });
    if (existing) return res.status(400).json({ message: "La agencia ya existe." });
    const nueva = await Agencia.create({
      nombre,
      direccion,
      telefono,
      ciudad,
      activo: activo ?? true,
    });
    return res.status(201).json(nueva);
  } catch (error) {
    return res.status(500).json({ message: "Error al crear la agencia", error });
  }
});

router.get("/", async (_req, res) => {
  try {
    const agencias = await Agencia.findAll({ order: [["nombre", "ASC"]] });
    return res.json(agencias);
  } catch (error) {
    return res.status(500).json({ message: "Error al obtener agencias", error });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const agencia = await Agencia.findByPk(req.params.id);
    if (!agencia) return res.status(404).json({ message: "Agencia no encontrada" });
    return res.json(agencia);
  } catch (error) {
    return res.status(500).json({ message: "Error al obtener agencia", error });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const agencia = await Agencia.findByPk(req.params.id);
    if (!agencia) return res.status(404).json({ message: "Agencia no encontrada" });
    const { nombre, direccion, telefono, ciudad, activo } = req.body;
    agencia.nombre = nombre ?? agencia.nombre;
    agencia.direccion = direccion ?? agencia.direccion;
    agencia.telefono = telefono ?? agencia.telefono;
    agencia.ciudad = ciudad ?? agencia.ciudad;
    agencia.activo = activo ?? agencia.activo;
    await agencia.save();
    return res.json(agencia);
  } catch (error) {
    return res.status(500).json({ message: "Error al actualizar agencia", error });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const agencia = await Agencia.findByPk(req.params.id);
    if (!agencia) return res.status(404).json({ message: "Agencia no encontrada" });
    await agencia.destroy();
    return res.json({ message: "Agencia eliminada correctamente" });
  } catch (error) {
    return res.status(500).json({ message: "Error al eliminar agencia", error });
  }
});

module.exports = router;

