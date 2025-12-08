const express = require("express");
const router = express.Router();
const Venta = require("../models/Venta");
const UsuarioAgencia = require("../models/UsuarioAgencia");
const Cliente = require("../models/Cliente");
const Origen = require("../models/Origen");
const DetalleVenta = require("../models/DetalleVenta");
const { validarVenta, getVentasPorUsuarioAgencia } = require("../controllers/ventaController");
const { default: upload } = require("../middleware/multer");

// --------------------- CONTROLADORES ---------------------
router.put("/venta/:id/validar", upload.single("foto"), validarVenta);
 
router.get("/vendedor/:usuarioAgenciaId", getVentasPorUsuarioAgencia);

// Listar todas las ventas 
router.get("/", async (req, res) => {
  try {
    const ventas = await Venta.findAll({
      include: [
        { model: UsuarioAgencia, as: "usuarioAgencia" },
        { model: Cliente, as: "cliente" },
        { model: Origen, as: "origen" },
        { model: DetalleVenta, as: "detalleVenta", include: ["dispositivoMarca"] },
      ],
    });
    res.json(ventas);
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: "Error al obtener las ventas." });
  }
});

// Obtener una venta por ID
router.get("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const venta = await Venta.findByPk(id, {
      include: [
        { model: UsuarioAgencia, as: "usuarioAgencia" },
        { model: Cliente, as: "cliente" },
        { model: Origen, as: "origen" },
        { model: DetalleVenta, as: "detalleVenta", include: ["dispositivoMarca"] },
      ],
    });
    if (!venta) return res.status(404).json({ mensaje: "Venta no encontrada." });
    res.json(venta);
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: "Error al obtener la venta." });
  }
});

// Crear una nueva venta
router.post("/", async (req, res) => {
  const { usuarioAgenciaId, clienteId, origenId,  activo, observacion  , fecha} = req.body;
  try {
    const nuevaVenta = await Venta.create({ usuarioAgenciaId, clienteId, origenId,  activo, observacion, fecha });
    res.status(201).json(nuevaVenta);
  } catch (error) {
    console.error(error); 
    res.status(500).json({ mensaje: "Error al crear la venta." });
  }
});

// Actualizar una venta
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const { usuarioAgenciaId, clienteId, origenId,  activo, observacion , fecha} = req.body;
  try {
    const venta = await Venta.findByPk(id);
    if (!venta) return res.status(404).json({ mensaje: "Venta no encontrada." });

    await venta.update({ usuarioAgenciaId, clienteId, origenId,  activo, observacion , fecha});
    res.json(venta);
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: "Error al actualizar la venta." });
  }
});

// Eliminar una venta
router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const venta = await Venta.findByPk(id);
    if (!venta) return res.status(404).json({ mensaje: "Venta no encontrada." });

    await venta.destroy();
    res.json({ mensaje: "Venta eliminada correctamente." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: "Error al eliminar la venta." });
  }
});

module.exports = router;
