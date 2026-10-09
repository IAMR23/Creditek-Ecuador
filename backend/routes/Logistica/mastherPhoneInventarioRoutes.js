const express = require("express");
const controller = require("../../controllers/Logistica/mastherPhoneInventarioController");
const {
  authenticate,
  requirePermission,
} = require("../../middleware/authMiddleware");

const router = express.Router();

router.use(authenticate, requirePermission("Logistica", "Administracion"));
router.get("/catalogos", controller.catalogos);
router.get("/reporte", controller.reporte);
router.get("/ingresos", controller.listarIngresos);
router.post("/ingresos", controller.registrarIngreso);
router.put("/ingresos/:ingresoId", controller.actualizarIngreso);
router.put(
  "/conciliaciones/:modeloId/:semanaInicio",
  controller.guardarConciliacion,
);

module.exports = router;
