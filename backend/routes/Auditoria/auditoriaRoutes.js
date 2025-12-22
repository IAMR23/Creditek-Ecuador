const express = require("express");
const router = express.Router();
const auditoriaVentasController = require("../../controllers/Auditoria/auditoriaVentasController");

router.get("/ventas", async (req, res) => {
  try {
    const { fechaInicio, fechaFin, agenciaId, vendedorId } = req.query;

    const ventas = await auditoriaVentasController.obtenerReporte({
      fechaInicio,
      fechaFin,
      agenciaId,
      vendedorId,
    });

    const reporte = auditoriaVentasController.formatearReporte(ventas);

    res.json({ ok: true, ventas: reporte });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, error: error.message });
  }
});




module.exports = router;