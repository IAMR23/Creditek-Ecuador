const pagosComisionesService = require("../../services/pagosComisionesService");

const responderError = (res, error) => {
  const status = error.statusCode || 500;
  res.status(status).json({
    message: error.message || "Error al procesar pagos de comisiones",
  });
};

const obtenerReporte = async (req, res) => {
  try {
    const reporte = await pagosComisionesService.obtenerReportePagosComisiones(req.query);
    res.json(reporte);
  } catch (error) {
    responderError(res, error);
  }
};

module.exports = {
  obtenerReporte,
};
