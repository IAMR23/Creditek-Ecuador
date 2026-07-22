const express = require("express");
const {
  authenticate,
  requirePermission,
} = require("../../middleware/authMiddleware");
const controller = require("../../controllers/Contabilidad/controlFinancieroController");

const router = express.Router();

router.use(authenticate, requirePermission("Contabilidad", "Administracion"));

router.get("/cargas", controller.listarCargas);
router.get("/cargas/:id", controller.obtenerCarga);
router.delete("/cargas/:id", controller.eliminarCarga);

module.exports = router;
