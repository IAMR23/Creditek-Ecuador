const metaMinimaMultaService = require("../../services/metaMinimaMultaService");

const responderError = (res, error) => {
  const status = error.statusCode || 500;
  res.status(status).json({
    message: error.message || "Error al procesar metas minimas sin multa",
  });
};

const listarConfiguraciones = async (req, res) => {
  try {
    const configs = await metaMinimaMultaService.listarConfiguraciones();
    res.json(configs);
  } catch (error) {
    responderError(res, error);
  }
};

const obtenerConfiguracion = async (req, res) => {
  try {
    const config = await metaMinimaMultaService.obtenerConfiguracion(req.params.id);
    res.json(config);
  } catch (error) {
    responderError(res, error);
  }
};

const crearConfiguracion = async (req, res) => {
  try {
    const config = await metaMinimaMultaService.crearConfiguracion(
      req.body,
      req.user.id,
    );
    res.status(201).json(config);
  } catch (error) {
    responderError(res, error);
  }
};

const actualizarConfiguracion = async (req, res) => {
  try {
    const config = await metaMinimaMultaService.actualizarConfiguracion(
      req.params.id,
      req.body,
      req.user.id,
    );
    res.json(config);
  } catch (error) {
    responderError(res, error);
  }
};

const cambiarEstadoConfiguracion = async (req, res) => {
  try {
    const config = await metaMinimaMultaService.cambiarEstadoConfiguracion(
      req.params.id,
      { activo: req.body.activo },
      req.user.id,
    );
    res.json(config);
  } catch (error) {
    responderError(res, error);
  }
};

const obtenerDashboard = async (req, res) => {
  try {
    const resultado = await metaMinimaMultaService.obtenerMetaMinimaDashboard(
      req.query,
    );
    res.json(resultado);
  } catch (error) {
    responderError(res, error);
  }
};

module.exports = {
  listarConfiguraciones,
  obtenerConfiguracion,
  crearConfiguracion,
  actualizarConfiguracion,
  cambiarEstadoConfiguracion,
  obtenerDashboard,
};
