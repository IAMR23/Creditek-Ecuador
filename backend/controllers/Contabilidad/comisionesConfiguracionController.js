const service = require("../../services/comisionesConfiguracionService");

const responderError = (res, error) => {
  const status = error.statusCode || 500;
  res.status(status).json({
    message: error.message || "Error al procesar configuracion de comisiones",
  });
};

const listarComisiones = async (req, res) => {
  try {
    const registros = await service.listarComisiones(req.query);
    res.json(registros);
  } catch (error) {
    responderError(res, error);
  }
};

const obtenerComision = async (req, res) => {
  try {
    const registro = await service.obtenerComision(req.params.id);
    res.json(registro);
  } catch (error) {
    responderError(res, error);
  }
};

const crearComision = async (req, res) => {
  try {
    const registro = await service.crearComision(req.body);
    res.status(201).json(registro);
  } catch (error) {
    responderError(res, error);
  }
};

const actualizarComision = async (req, res) => {
  try {
    const registro = await service.actualizarComision(req.params.id, req.body);
    res.json(registro);
  } catch (error) {
    responderError(res, error);
  }
};

const desactivarComision = async (req, res) => {
  try {
    const registro = await service.desactivarComision(req.params.id);
    res.json(registro);
  } catch (error) {
    responderError(res, error);
  }
};

module.exports = {
  listarComisiones,
  obtenerComision,
  crearComision,
  actualizarComision,
  desactivarComision,
};
