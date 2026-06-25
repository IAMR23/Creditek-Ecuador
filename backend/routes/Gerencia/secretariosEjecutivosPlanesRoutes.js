const express = require("express");
const {
  authenticate,
  requirePermission,
} = require("../../middleware/authMiddleware");
const controller = require("../../controllers/Gerencia/secretariosEjecutivosPlanesController");

const router = express.Router();

router.use(authenticate, requirePermission("Gerencia"));

router.get("/", controller.listarMisPlanes);
router.post("/", controller.crearPlan);
router.put("/:id", controller.actualizarPlan);
router.patch("/:id/estado", controller.cambiarEstado);

module.exports = router;
