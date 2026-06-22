const express = require("express");
const router = express.Router();
const tareasController = require("../../controllers/Sistemas/tareasController");
const {
  authenticate,
  requirePermission,
} = require("../../middleware/authMiddleware");

const accesoSistemas = [authenticate, requirePermission("Sistemas", "Administracion")];

router.get("/", accesoSistemas, tareasController.listarTareas);
router.post("/", accesoSistemas, tareasController.crearTarea);
router.put("/:id", accesoSistemas, tareasController.actualizarTarea);
router.delete("/:id", accesoSistemas, tareasController.eliminarTarea);
router.patch("/:id/iniciar", accesoSistemas, tareasController.iniciarTarea);
router.patch("/:id/pausar", accesoSistemas, tareasController.pausarTarea);
router.patch("/:id/continuar", accesoSistemas, tareasController.continuarTarea); 
router.patch("/:id/finalizar", accesoSistemas, tareasController.finalizarTarea);
router.patch("/:id/estado", accesoSistemas, tareasController.cambiarEstado);

module.exports = router;
