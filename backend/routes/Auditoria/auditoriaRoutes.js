const express = require("express");
const router = express.Router();
const auditoriaVentasController = require("../../controllers/Auditoria/auditoriaVentasController");
const { calcularEstadisticasVentas, comiteCompras } = require("../../utils/calcularEstadisticasVentas");

router.get("/ventas", async (req, res) => {
  try {
    const {
      fechaInicio,
      fechaFin,
      agenciaId,
      vendedorId,
      modeloId,
      cierreCaja,
      origenId,
      dispositivoId,
      estado,
    } = req.query;

    const ventas = await auditoriaVentasController.obtenerReporteAuditoria({
      fechaInicio,
      fechaFin,
      agenciaId,
      vendedorId,
      modeloId,
      cierreCaja,
      origenId,
      dispositivoId,
      estado,
    });

    const reporte = auditoriaVentasController.formatearReporte(ventas);
    res.json({ ok: true, ventas: reporte , totalVentas : ventas.length});
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

router.get("/informe", async (req, res) => {
  try {
    const { fechaInicio, fechaFin, agenciaId, vendedorId   , observacion} = req.query;

    const ventas = await auditoriaVentasController.obtenerReporte({
      fechaInicio,
      fechaFin,
      agenciaId,
      vendedorId,
      observacion   , 
    });

    const reporte = auditoriaVentasController.formatearReporte(ventas);
    res.json({ ok: true, ventas: reporte , totalVentas : ventas.length});
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

  
router.get("/ventas2", async (req, res) => {
  try {
    const { fechaInicio, fechaFin, agenciaId, vendedorId , cierreCaja  } = req.query;

    const ventas = await auditoriaVentasController.obtenerReporteGerencia({
      fechaInicio,
      fechaFin,
      agenciaId,
      vendedorId,
      cierreCaja
    });

    const reporte = auditoriaVentasController.formatearReporte(ventas);

    const estadisticas = calcularEstadisticasVentas(reporte , fechaInicio);
 
    res.json({ ok: true, estadisticas});
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, error: error.message });
  }
});




module.exports = router;
