const express = require("express");
const router = express.Router();
const auditoriaVentasController = require("../../controllers/Auditoria/auditoriaVentasController");
/* TODAS LAS VENTAS DEL VENDEDOR*/   
router.get("/ventas", async (req, res) => {
  try {
    const { fechaInicio, fechaFin } = req.query;
    const { id } = req.params;
    const ventas = await auditoriaVentasController.obtenerReporte({
      id,
      fechaInicio,
      fechaFin,
    });
    const reporte = await auditoriaVentasController.formatearReporte(ventas);
    res.json({ ok: true, ventas: reporte });
  } catch (error) {
    console.log(error);
    res.status(500).json({ ok: false, error: error.message });
  }
}); 


module.exports = router;