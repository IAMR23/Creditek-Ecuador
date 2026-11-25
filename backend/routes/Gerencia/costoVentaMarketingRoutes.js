const express = require("express");
const router = express.Router();
const {
  authenticate,
  requirePermission,
} = require("../../middleware/authMiddleware");
const controller = require("../../controllers/Gerencia/costoVentaMarketingController");

router.use(authenticate);

router.get(
  "/reporte-costo-venta",
  requirePermission("Gerencia"),
  controller.obtenerReporteCostoVenta,
);
router.get(
  "/reporte-costo-entrega",
  requirePermission("Logistica"),
  controller.obtenerReporteCostoEntrega,
);
router.get(
  "/reporte-costo-entrega-total",
  requirePermission("Logistica"),
  controller.obtenerReporteCostoEntregaTotal,
);

router.post("/presupuesto-marketing", requirePermission("Gerencia"), controller.crearPresupuesto);
router.get("/presupuesto-marketing", requirePermission("Gerencia"), controller.listarPresupuestos);
router.get("/presupuesto-marketing/:id", requirePermission("Gerencia"), controller.obtenerPresupuesto);
router.put("/presupuesto-marketing/:id", requirePermission("Gerencia"), controller.actualizarPresupuesto);
router.delete("/presupuesto-marketing/:id", requirePermission("Gerencia"), controller.eliminarPresupuesto);

router.post("/gastos-marketing", requirePermission("Gerencia"), controller.crearGasto);
router.get("/gastos-marketing", requirePermission("Gerencia"), controller.listarGastos);
router.get("/gastos-marketing/:id", requirePermission("Gerencia"), controller.obtenerGasto);
router.put("/gastos-marketing/:id", requirePermission("Gerencia"), controller.actualizarGasto);
router.delete("/gastos-marketing/:id", requirePermission("Gerencia"), controller.eliminarGasto);

module.exports = router;
