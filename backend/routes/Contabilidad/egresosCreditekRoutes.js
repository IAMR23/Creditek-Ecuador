const express = require("express");
const {
  authenticate,
  requirePermission,
} = require("../../middleware/authMiddleware");
const controller = require("../../controllers/Contabilidad/egresosCreditekController");
const tiposController = require("../../controllers/Contabilidad/egresosCreditekTiposController");

const router = express.Router();

router.use(authenticate, requirePermission("Contabilidad", "Administracion"));
router.get("/:seccion/tipos", tiposController.listar);
router.post("/:seccion/tipos", tiposController.crear);
router.put("/:seccion/tipos/:tipoId", tiposController.actualizar);
router.delete("/:seccion/tipos/:tipoId", tiposController.desactivar);
router.get("/:seccion", controller.obtenerSeccion);
router.post("/:seccion", controller.crearRegistro);
router.put("/:seccion/:id", controller.actualizarRegistro);
router.delete("/:seccion/:id", controller.eliminarRegistro);
router.patch("/:seccion/:id/estado", controller.cambiarEstadoRegistro);

module.exports = router;
