const express = require("express");
const router = express.Router();

const { authenticate, requirePermission } = require("../../middleware/authMiddleware");
const controller = require("../../controllers/Contabilidad/rolesPagoController");

const requireRolesPago = requirePermission("Contabilidad", "Administracion");

router.use(authenticate, requireRolesPago);

router.get("/", controller.listarRolesPago);
router.get("/:id", controller.obtenerRolPago);
router.post("/", controller.crearRolPago);
router.put("/:id", controller.actualizarRolPago);
router.delete("/:id", controller.desactivarRolPago);

module.exports = router;
