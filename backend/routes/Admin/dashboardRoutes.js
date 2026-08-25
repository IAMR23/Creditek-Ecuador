const express = require("express");
const { getDashboardEntregas } = require("../../controllers/Admin/dashboardEntregaController");
const { getTotalVentas } = require("../../controllers/Admin/dashboardVentasTotalController");
const { authenticate, requirePermission } = require("../../middleware/authMiddleware");
const router = express.Router();

router.get(
  "/entregas",
  authenticate,
  requirePermission("Gerencia"),
  getDashboardEntregas,
);
router.get("/total-ventas", getTotalVentas);

module.exports = router;
