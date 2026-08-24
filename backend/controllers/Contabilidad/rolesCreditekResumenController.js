const service = require("../../services/rolesCreditekResumenService");

const responderError = (res, error) =>
  res.status(error.statusCode || 500).json({
    message: error.message || "No se pudo procesar el resumen de Roles Creditek",
  });

const obtenerResumen = async (req, res) => {
  try {
    res.json(
      await service.obtenerResumen({ anio: req.query.anio, mes: req.query.mes }),
    );
  } catch (error) {
    responderError(res, error);
  }
};

const guardarAjustes = async (req, res) => {
  try {
    res.json(await service.guardarAjustes(req.body, req.user.id));
  } catch (error) {
    responderError(res, error);
  }
};

module.exports = { guardarAjustes, obtenerResumen };
