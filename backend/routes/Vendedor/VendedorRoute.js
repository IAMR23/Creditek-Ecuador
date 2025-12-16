const express = require("express");
const router = express.Router();
const vendedorController = require("../../controllers/Vendedores/ventaVendedorController");
const entregaVendedorController = require("../../controllers/Vendedores/entregaVendedorController");



/* OBTENER UNA VENTA ESPECIFICA */
router.get("/venta/:id", vendedorController.obtenerVentaPorId);


/* OBTENER TODAS LAS ENTREGAS DEL VENDEDOR   */
router.get("/entrega/:id", async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const { id } = req.params;

    const entrega = await entregaVendedorController.obtenerReporte({
      id,
      page: Number(page),
      limit: Number(limit),
    });

    const reporte = await entregaVendedorController.formatearReporte(entrega);

    res.json({
      ok: true,
      page: Number(page),
      limit: Number(limit),
      total: entrega.count,
      totalPages: Math.ceil(entrega.count / limit),
      entrega: reporte,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

  
/* OBTENER UNA Entrega ESPECIFICA */
router.get("/entrega-logistica/:id", entregaVendedorController.obtenerEntregaPorId);


/* TODAS LAS VENTAS DEL VENDEDOR*/   
router.get("/:id", async (req, res) => {
  try {
    const { fechaInicio, fechaFin } = req.query;
    const { id } = req.params;
    const ventas = await vendedorController.obtenerReporte({
      id,
      fechaInicio,
      fechaFin,
    });
    const reporte = await vendedorController.formatearReporte(ventas);
    res.json({ ok: true, ventas: reporte });
  } catch (error) {
    console.log(error);
    res.status(500).json({ ok: false, error: error.message });
  }
}); 


module.exports = router;