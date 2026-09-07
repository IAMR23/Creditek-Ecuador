const express = require("express");
const {
  authenticate,
  requirePermission,
} = require("../../middleware/authMiddleware");
const controller = require("../../controllers/Contabilidad/rolesCreditekResumenController");
const novedades = require("../../controllers/Contabilidad/nominaNovedadesController");

const router = express.Router();

router.use(authenticate, requirePermission("Contabilidad", "Administracion"));
router.get("/novedades/:usuarioId", novedades.listar);
router.post("/novedades/preview", novedades.vistaPrevia);
router.post("/novedades", novedades.crear);
router.put("/novedades/:id", novedades.actualizar);
router.get("/", controller.obtenerResumen);
router.put("/", controller.guardarAjustes);
router.put("/nomina", controller.guardarNomina);

module.exports = router;
