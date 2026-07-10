const router = require("express").Router();
const { authenticate, requirePermission } = require("../../middleware/authMiddleware");
const controller = require("../../controllers/Contabilidad/sancionesVentasController");
router.use(authenticate, requirePermission("Contabilidad", "Administracion"));
router.get("/", controller.obtenerReporte);
module.exports = router;
