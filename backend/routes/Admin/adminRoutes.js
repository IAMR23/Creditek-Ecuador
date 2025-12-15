const express = require("express");
const router = express.Router();
const adminController = require("../../controllers/Admin/metasComercialesVentas");
const adminControllerEntregas = require("../../controllers/Admin/metasComercialesEntregas");
const { obtenerReporteGeneral } = require("../../controllers/Admin/reporteGeneral");

router.get("/ventas", async (req, res) => {
  try {
    const { fechaInicio, fechaFin, agenciaId } = req.query;
 
    const ventas = await adminController.obtenerReporte({
      fechaInicio,
      fechaFin,
      agenciaId,  
    });

    const reporte = adminController.formatearReporte(ventas);

    res.json({ ok: true, ventas: reporte });
  } catch (error) {
    console.log(error);
    res.status(500).json({ ok: false, error: error.message });
  }
});



router.get("/entregas", async (req, res) => {
  try {
    const { fechaInicio, fechaFin } = req.query;
    const entregas = await adminControllerEntregas.obtenerReporte({
      fechaInicio,
      fechaFin,
    });
    const reporte = adminControllerEntregas.formatearReporte(entregas);

    res.json({ ok: true, entregas: reporte });
  } catch (error) {
    console.log(error);
    res.status(500).json({ ok: false, error: error.message });
  } 
});


router.get("/general", async (req, res) => {
  try {
    const { fechaInicio, fechaFin, agenciaId } = req.query;

    const filas = await obtenerReporteGeneral({
      fechaInicio,
      fechaFin,
      agenciaId,
    });

    return res.json({
      ok: true,
      total: filas.length,
      data: filas,
    });
  } catch (error) {
    console.error("Error reporte general:", error);
    return res.status(500).json({
      ok: false,
      mensaje: "Error al generar el reporte general",
    });
  }
});



router.get("/entregas-logistica", async (req, res) => {
  try {
    const { fechaInicio, fechaFin } = req.query;
    const entregas = await adminControllerEntregas.obtenerReporte({
      fechaInicio,
      fechaFin,
    });

    res.json({ ok: true, entregas: entregas });
  } catch (error) {
    console.log(error);
    res.status(500).json({ ok: false, error: error.message });
  } 
});


module.exports = router;
