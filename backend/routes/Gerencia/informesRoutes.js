 const express = require("express");
 const router = express.Router();
 const infomeGerenciaController = require("../../controllers/Gerencia/informesController");
 const {
   authenticate,
   requirePermission,
 } = require("../../middleware/authMiddleware");

router.get(
  "/informe-ventas-con-entrega",
  authenticate,
  requirePermission("Gerencia"),
  infomeGerenciaController.obtenerVentasConEntrega,
);
 
router.get("/informe", async (req, res) => {
  try {
    const { fechaInicio, fechaFin, agenciaId, vendedorId   , observacion , origenId} = req.query;

    const ventas = await infomeGerenciaController.obtenerReporte({
      fechaInicio,
      fechaFin,
      agenciaId,
      vendedorId,
      observacion, 
      origenId
    });

   const reporte = infomeGerenciaController.formatearReporte(ventas);
    res.json({ ok: true, ventas: reporte , totalVentas : ventas.length});
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

module.exports = router;
