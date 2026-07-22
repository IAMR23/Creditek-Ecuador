const express = require("express");
const {
  authenticate,
  requirePermission,
} = require("../../middleware/authMiddleware");
const controller = require("../../controllers/Contabilidad/controlFinancieroController");

const router = express.Router();

router.use(authenticate, requirePermission("Contabilidad", "Administracion"));

router.get("/cargas", controller.listarCargas);
router.get("/cargas/consolidado-ventas", controller.consolidarVentas);
router.get("/cargas/:id", controller.obtenerCarga);
router.patch("/cargas/:id/anular", controller.anularCarga);

module.exports = router;
