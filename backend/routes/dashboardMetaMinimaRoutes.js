const express = require("express");
const router = express.Router();

const { authenticate, requirePermission } = require("../middleware/authMiddleware");
const controller = require("../controllers/Contabilidad/metaMinimaMultaController");

const requireDashboardMetaMinima = requirePermission("Contabilidad", "Administracion");

router.get(
  "/meta-minima-sin-multa",
  authenticate,
  requireDashboardMetaMinima,
  controller.obtenerDashboard,
);

module.exports = router;
