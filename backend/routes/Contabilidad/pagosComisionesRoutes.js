const express = require("express");
const router = express.Router();

const { authenticate, requirePermission } = require("../../middleware/authMiddleware");
const controller = require("../../controllers/Contabilidad/pagosComisionesController");

const requirePagosComisiones = requirePermission("Contabilidad", "Administracion");

router.use(authenticate, requirePagosComisiones);

router.get("/", controller.obtenerReporte);

module.exports = router;
