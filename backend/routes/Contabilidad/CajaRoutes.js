const express = require("express");
const router = express.Router();

const { authenticate, requirePermission } = require("../../middleware/authMiddleware");
const {
  cerrarCaja,
  obtenerCierreCajaPorId,
  obtenerTodosLosCierresCaja,
  obtenerCierresCajaLegacy,
  obtenerEstadoCierreUsuario,
  obtenerFiltrosCierresCaja,
  reabrirCierreCaja,
  actualizarCierreCajaReabierto,
} = require("../../controllers/CierreCaja/cierreCaja");

const normalizarRol = (rol) =>
  String(rol || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

const requireAdminRole = (req, res, next) => {
  const rol = normalizarRol(req.user?.rol);

  if (!["admin", "administrador"].includes(rol)) {
    return res.status(403).json({
      message: "Solo un administrador puede realizar esta accion",
    });
  }

  next();
};

const requireLecturaCaja = requirePermission("Contabilidad", "Administracion");

router.post("/cierre-caja", authenticate, cerrarCaja);
router.get("/cierre-caja/estado", authenticate, obtenerEstadoCierreUsuario);
  
router.get(
  "/cierres-caja/filtros",
  authenticate, 
  requireLecturaCaja,
  obtenerFiltrosCierresCaja,  
);

router.get(
  "/cierres-caja1",
  authenticate,
  requireLecturaCaja,
  obtenerCierresCajaLegacy,
);

router.get(
  "/cierres-caja",
  authenticate,
  requireLecturaCaja,
  obtenerTodosLosCierresCaja,
);

router.get(
  "/cierre-caja/:id",
  authenticate,
  requireLecturaCaja,
  obtenerCierreCajaPorId,
);

router.patch(
  "/cierre-caja/:id/reabrir",
  authenticate,
  requireAdminRole,
  reabrirCierreCaja,
);

router.put(
  "/cierre-caja/:id",
  authenticate,
  requireAdminRole,
  actualizarCierreCajaReabierto,
);

module.exports = router;
