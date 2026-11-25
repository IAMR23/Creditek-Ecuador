const express = require("express");
const { authenticate, requirePermission } = require("../../middleware/authMiddleware");
const controller = require("../../controllers/Contabilidad/rolesPagoJuniorsController");

const router = express.Router();
router.use(authenticate, requirePermission("Contabilidad"));
router.get("/", controller.listar);
router.post("/", controller.crear);
router.patch("/:id/estado", controller.cambiarEstado);

module.exports = router;
