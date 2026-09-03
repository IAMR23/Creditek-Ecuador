const express = require("express");
const {
  authenticate,
  requirePermission,
} = require("../../middleware/authMiddleware");
const controller = require("../../controllers/Contabilidad/egresosCreditekController");

const router = express.Router();

router.use(authenticate, requirePermission("Contabilidad", "Administracion"));
router.get("/:seccion", controller.obtenerSeccion);
router.post("/:seccion", controller.crearRegistro);
router.put("/:seccion/:id", controller.actualizarRegistro);
router.delete("/:seccion/:id", controller.eliminarRegistro);
router.patch("/:seccion/:id/estado", controller.cambiarEstadoRegistro);

module.exports = router;
