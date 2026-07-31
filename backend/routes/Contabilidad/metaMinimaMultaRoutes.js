const express = require("express");
const router = express.Router();

const { authenticate, requirePermission } = require("../../middleware/authMiddleware");
const controller = require("../../controllers/Contabilidad/metaMinimaMultaController");

const requireMetaMinima = requirePermission("Contabilidad", "Administracion");

router.use(authenticate, requireMetaMinima);

router.get("/", controller.listarConfiguraciones);
router.get("/:id", controller.obtenerConfiguracion);
router.post("/", controller.crearConfiguracion);
router.put("/:id", controller.actualizarConfiguracion);
router.patch("/:id/estado", controller.cambiarEstadoConfiguracion);

module.exports = router;
