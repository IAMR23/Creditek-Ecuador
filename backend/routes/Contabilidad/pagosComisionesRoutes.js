const express = require("express");
const router = express.Router();

const { authenticate, requirePermission } = require("../../middleware/authMiddleware");
const controller = require("../../controllers/Contabilidad/pagosComisionesController");

const requirePagosComisiones = requirePermission("Contabilidad", "Administracion");

router.use(authenticate, requirePagosComisiones);

router.get("/", controller.obtenerReporte);
router.put("/vendedores/:usuarioId/jefe-comercial", controller.actualizarJefeComercial);
router.put("/vendedores/:usuarioId/supervisor-comercial", controller.actualizarSupervisorComercial);

module.exports = router;
