const express = require("express");
const {
  authenticate,
  requirePermission,
} = require("../../middleware/authMiddleware");
const controller = require("../../controllers/Contabilidad/descuentosDecimosController");

const router = express.Router();
const requireContabilidad = requirePermission("Contabilidad");

router.use(authenticate, requireContabilidad);
router.get("/", controller.obtener);
router.put("/", controller.guardar);

module.exports = router;
