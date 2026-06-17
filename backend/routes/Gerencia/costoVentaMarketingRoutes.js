const express = require("express");
const router = express.Router();
const {
  authenticate,
  requirePermission,
} = require("../../middleware/authMiddleware");
const controller = require("../../controllers/Gerencia/costoVentaMarketingController");

router.use(authenticate);
router.use(requirePermission("Gerencia", "Administracion"));

router.get("/reporte-costo-venta", controller.obtenerReporteCostoVenta);

router.post("/presupuesto-marketing", controller.crearPresupuesto);
router.get("/presupuesto-marketing", controller.listarPresupuestos);
router.get("/presupuesto-marketing/:id", controller.obtenerPresupuesto);
router.put("/presupuesto-marketing/:id", controller.actualizarPresupuesto);
router.delete("/presupuesto-marketing/:id", controller.eliminarPresupuesto);

router.post("/gastos-marketing", controller.crearGasto);
router.get("/gastos-marketing", controller.listarGastos);
router.get("/gastos-marketing/:id", controller.obtenerGasto);
router.put("/gastos-marketing/:id", controller.actualizarGasto);
router.delete("/gastos-marketing/:id", controller.eliminarGasto);

module.exports = router;
