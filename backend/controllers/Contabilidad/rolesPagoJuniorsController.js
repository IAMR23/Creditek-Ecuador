const service = require("../../services/rolesPagoJuniorsService");

const responderError = (res, error) => res
  .status(error.statusCode || 500)
  .json({ message: error.statusCode ? error.message : "No se pudo procesar la relación de cargos" });

const listar = async (req, res) => {
  try {
    res.json(await service.listar(req.query));
  } catch (error) {
    responderError(res, error);
  }
};

const crear = async (req, res) => {
  try {
    res.status(201).json(await service.crear(req.body));
  } catch (error) {
    responderError(res, error);
  }
};

const cambiarEstado = async (req, res) => {
  try {
    res.json(await service.cambiarEstado(req.params.id, req.body.activo));
  } catch (error) {
    responderError(res, error);
  }
};

module.exports = { listar, crear, cambiarEstado };
