const express = require("express");
const {
  authenticate,
  requirePermission,
} = require("../../middleware/authMiddleware");
const controller = require("../../controllers/Marketing/copaCreditekController");

const router = express.Router();

router.use(authenticate, requirePermission("Marketing"));

router.get("/", controller.obtener);
router.put("/configuracion-completa", controller.guardarConfiguracionCompleta);
router.patch(
  "/vendedores/:usuarioId/configuracion",
  controller.actualizarConfiguracion,
);
router.put("/vendedores/:usuarioId/periodo/meta", controller.actualizarMeta);
router.put(
  "/vendedores/:usuarioId/periodo/ventas-manual",
  controller.actualizarVentasManual,
);
router.delete(
  "/vendedores/:usuarioId/periodo/ventas-manual",
  controller.restaurarVentasAutomaticas,
);

module.exports = router;
