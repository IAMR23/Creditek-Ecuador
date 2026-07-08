const express = require("express");
const router = express.Router();

const { authenticate, requirePermission } = require("../../middleware/authMiddleware");
const controller = require("../../controllers/Contabilidad/comisionesConfiguracionController");

const requireComisiones = requirePermission("Contabilidad", "Administracion");

router.use(authenticate, requireComisiones);

router.get("/", controller.listarComisiones);
router.get("/:id", controller.obtenerComision);
router.post("/", controller.crearComision);
router.put("/:id", controller.actualizarComision);
router.delete("/:id", controller.desactivarComision);

module.exports = router;
