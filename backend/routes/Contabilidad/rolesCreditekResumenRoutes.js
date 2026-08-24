const express = require("express");
const {
  authenticate,
  requirePermission,
} = require("../../middleware/authMiddleware");
const controller = require("../../controllers/Contabilidad/rolesCreditekResumenController");

const router = express.Router();

router.use(authenticate, requirePermission("Contabilidad", "Administracion"));
router.get("/", controller.obtenerResumen);
router.put("/", controller.guardarAjustes);

module.exports = router;
