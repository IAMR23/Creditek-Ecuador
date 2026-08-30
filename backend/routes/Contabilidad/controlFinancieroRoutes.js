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
router.get("/cargas/cobertura-reportes", controller.obtenerCoberturaReportes);
router.get("/responsables-pago", controller.listarResponsablesPagoEntrada);
router.patch(
  "/registros/:registroId/pago-entrada",
  controller.actualizarPagoEntrada,
);
router.patch(
  "/registros/:registroId/gestion-caja-no-en-cierre",
  controller.actualizarGestionCajaNoEnCierre,
);
router.get(
  "/cargas/:cargaId/conciliacion-entradas",
  controller.obtenerConciliacionEntradas,
);
router.post(
  "/cargas/:cargaId/conciliacion-entradas/reconciliar",
  controller.reconciliarEntradas,
);
router.post(
  "/cargas/:cargaId/conciliacion-entradas/:resultadoId/confirmar",
  controller.confirmarConciliacionEntrada,
);
router.get(
  "/cargas/:cargaId/conciliacion-caja",
  controller.obtenerConciliacionCaja,
);
router.get(
  "/cargas/:cargaId/conciliacion-caja/historial",
  controller.obtenerHistorialConciliacionCaja,
);
router.post(
  "/cargas/:cargaId/reconciliar-caja",
  controller.reconciliarCaja,
);
router.get("/cargas/:id", controller.obtenerCarga);
router.patch("/cargas/:id/anular", controller.anularCarga);

module.exports = router;
