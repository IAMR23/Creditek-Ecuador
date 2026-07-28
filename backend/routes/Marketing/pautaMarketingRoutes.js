const express = require("express");
const {
  authenticate,
  requirePermission,
} = require("../../middleware/authMiddleware");
const {
  procesarImagenMarketing,
} = require("../../middleware/uploadMarketing");
const controller = require("../../controllers/Marketing/pautaMarketingController");

const router = express.Router();

router.use(authenticate, requirePermission("Marketing", "Administracion"));

router.get("/", controller.listar);
router.post("/", procesarImagenMarketing, controller.crear);
router.put("/:id", procesarImagenMarketing, controller.actualizar);
router.delete("/:id", controller.eliminar);

module.exports = router;
