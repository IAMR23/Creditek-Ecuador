const express = require("express");
const router = express.Router();

const Postulacion = require("../../models/Postulacion");  

router.post("/", async (req, res) => {
  try {
    const payload = req.body;

    const postulacion = await Postulacion.create({
      nombre: payload.datos_personales?.nombre ?? null,
      cedula: payload.datos_personales?.cedula ?? null,
      telefono: payload.datos_personales?.telefono ?? null,
      formulario: payload, // 🔥 JSONB directo
    });

    res.status(201).json({
      ok: true,
      message: "Postulación guardada",
      id: postulacion.id,
    });

  } catch (error) {
    console.error("Error guardando postulación:", error);
    res.status(500).json({
      ok: false,
      message: "Error al guardar postulación",
    });
  }
});

router.get("/", async (req, res) => {
  try {
    const postulaciones = await Postulacion.findAll({
      order: [["createdAt", "DESC"]],
    });

    res.json({
      ok: true,
      data: postulaciones,
    });

  } catch (error) {
    console.error("Error obteniendo postulaciones:", error);
    res.status(500).json({
      ok: false,
      message: "Error al obtener postulaciones",
    });
  }
});



router.get("/cedula/:cedula", async (req, res) => {
  try {
    const { cedula } = req.params;

    const postulacion = await Postulacion.findOne({
      where: { cedula },
    });

    if (!postulacion) {
      return res.status(404).json({
        ok: false,
        message: "Postulación no encontrada",
      });
    }

    res.json({
      ok: true,
      data: postulacion,
    });

  } catch (error) {
    console.error("Error buscando postulación por cédula:", error);
    res.status(500).json({
      ok: false,
      message: "Error al buscar postulación",
    });
  }
});


module.exports = router;
 