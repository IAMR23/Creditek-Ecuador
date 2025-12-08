const express = require("express");
const { getDashboardEntregas } = require("../../controllers/Admin/dashboardEntregaController");
const { getTotalVentas } = require("../../controllers/Admin/dashboardVentasTotalController");
const router = express.Router();

router.get("/entregas", getDashboardEntregas);
router.get("/total-ventas", getTotalVentas);

module.exports = router;
 