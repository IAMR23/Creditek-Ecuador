const express = require("express");
const router = express.Router();
const Entrega = require("../models/Entrega");
const UsuarioAgencia = require("../models/UsuarioAgencia");
const Cliente = require("../models/Cliente");
const Origen = require("../models/Origen");
const DetalleEntrega = require("../models/DetalleEntrega");
const { default: upload } = require("../middleware/multer");
const { fotoClienteRespaldo, getEntregasPorUsuarioAgencia, fotoFechaRespaldo, fotoLogisticaRespaldo } = require("../controllers/entregaController");

// --------------------- CONTROLADORES ---------------------
router.put("/entrega/:id/validar", upload.single("foto"), fotoClienteRespaldo);
router.put("/entrega/:id/fechaRespaldo", upload.single("foto"), fotoFechaRespaldo);
router.put("/entrega/:id/fotoLogistica", upload.single("foto"), fotoLogisticaRespaldo);

router.get("/vendedor/:usuarioAgenciaId", getEntregasPorUsuarioAgencia);

router.get("/", async (req, res) => { 
  try {  
    const entregas = await Entrega.findAll({
      include: [
        { model: UsuarioAgencia, as: "usuarioAgencia" },
        { model: Cliente, as: "cliente" },
        { model: Origen, as: "origen" },
        { model: DetalleEntrega, as: "detalleEntregas", include: ["dispositivoMarca"] },
      ],
    });
    res.json(entregas);
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: "Error al obtener las entregas." });
  }
});

// Obtener una entrega por ID
router.get("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const entrega = await Entrega.findByPk(id, {
      include: [
        { model: UsuarioAgencia, as: "usuarioAgencia" },
        { model: Cliente, as: "cliente" },
        { model: Origen, as: "origen" },
        { model: DetalleEntrega, as: "detalleEntregas", include: ["dispositivoMarca"] },
      ],
    });
    if (!entrega) return res.status(404).json({ mensaje: "Entrega no encontrada." });
    res.json(entrega);
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: "Error al obtener la entrega." });
  }
});

// Crear una nueva entrega
router.post("/", async (req, res) => {
  const data  = req.body;
  try {
    const nuevaEntrega = await Entrega.create(data);
    res.status(201).json(nuevaEntrega);
  } catch (error) {
    console.error(error); 
    res.status(500).json({ mensaje: "Error al crear la entrega." });
  }
});

// Actualizar una entrega
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const data = req.body;
  try {
    const entrega = await Entrega.findByPk(id);
    if (!entrega) return res.status(404).json({ mensaje: "Entrega no encontrada." });

    await entrega.update(data);
    res.json(entrega);
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: "Error al actualizar la entrega." });
  }
});

// Eliminar una entrega
router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const entrega = await Entrega.findByPk(id);
    if (!entrega) return res.status(404).json({ mensaje: "Entrega no encontrada." });

    await entrega.destroy();
    res.json({ mensaje: "Entrega eliminada correctamente." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: "Error al eliminar la entrega." });
  }
});

module.exports = router;
