const express = require("express");
const {
  obtenerMatrizOportunidadesDashboard,
} = require("../../services/ghlService");
const {
  authenticate,
  requirePermission,
} = require("../../middleware/authMiddleware");

const router = express.Router();
const accesoDashboardGhl = [
  authenticate,
  requirePermission("Gerencia", "Administracion", "Sistemas"),
];

router.get("/oportunidades/matriz", accesoDashboardGhl, async (req, res) => {
  try {
    const matriz = await obtenerMatrizOportunidadesDashboard({
      fechaInicio: req.query.fechaInicio,
      fechaFin: req.query.fechaFin,
    });

    return res.json({
      ok: true,
      ...matriz,
    });
  } catch (error) {
    console.error("Error consultando dashboard GHL:", {
      code: error.code,
      message: error.message,
      statusCode: error.statusCode,
    });

    return res.status(error.statusCode || 500).json({
      ok: false,
      code: error.code || "GHL_DASHBOARD_ERROR",
      message: error.message || "No se pudo cargar el dashboard de HighLevel",
    });
  }
});

module.exports = router;
