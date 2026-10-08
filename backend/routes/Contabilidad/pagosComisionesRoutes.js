const express = require("express");
const router = express.Router();

const { authenticate, requirePermission } = require("../../middleware/authMiddleware");
const controller = require("../../controllers/Contabilidad/pagosComisionesController");

const requirePagosComisiones = requirePermission("Contabilidad", "Administracion");

router.use(authenticate, requirePagosComisiones);

router.get("/", controller.obtenerReporte);
router.get("/configuracion-meses", controller.listarConfiguracionMeses);
router.get("/configuracion-meses/:year/:month", controller.obtenerConfiguracionMes);
router.put("/configuracion-meses/:year/:month", controller.actualizarConfiguracionMes);
router.put("/configuracion-anual/:year", controller.actualizarConfiguracionAnual);
router.put("/periodos/:year/:month/pagado", controller.marcarPeriodoPagado);
router.put("/multas", controller.actualizarValoresMultas);
router.put(
  "/vendedores/:usuarioId/personal-nuevo-bono/:year/:month",
  controller.actualizarPersonalNuevoBono,
);
router.put("/vendedores/:usuarioId/jefe-comercial", controller.actualizarJefeComercial);
router.put("/vendedores/:usuarioId/supervisor-comercial", controller.actualizarSupervisorComercial);
router.put(
  "/jefes/:jefeComercialId/equipos-semanales/:semanaInicio",
  controller.guardarEquipoSemanalJefeComercial,
);
router.delete(
  "/jefes/:jefeComercialId/equipos-semanales/:semanaInicio",
  controller.eliminarEquipoSemanalJefeComercial,
);
router.put(
  "/jefes/:jefeComercialId/promedio-mensual/:year/:month",
  controller.guardarPromedioMensualJefeComercial,
);
router.put(
  "/jefes/:jefeComercialId/meta-mensual/:year/:month",
  controller.guardarMetaMensualJefeComercial,
);
router.put(
  "/supervisores/:supervisorComercialId/equipos-semanales/:semanaInicio",
  controller.guardarEquipoSemanalSupervisorComercial,
);
router.delete(
  "/supervisores/:supervisorComercialId/equipos-semanales/:semanaInicio",
  controller.eliminarEquipoSemanalSupervisorComercial,
);
router.put(
  "/supervisores/:supervisorComercialId/promedio-mensual/:year/:month",
  controller.guardarPromedioMensualSupervisorComercial,
);
router.put(
  "/vendedores/:usuarioId/multas/:semanaInicio",
  controller.actualizarOmisionMulta,
);

module.exports = router;
