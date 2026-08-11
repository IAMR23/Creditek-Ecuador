const descuentosDecimosService = require("../../services/descuentosDecimosService");

const responderError = (res, error) => {
  res.status(error.statusCode || 500).json({
    message: error.message || "No se pudieron procesar los descuentos de décimos",
  });
};

const obtener = async (req, res) => {
  try {
    const resultado = await descuentosDecimosService.obtenerDescuentosDecimos(
      req.query.anio,
    );
    res.json(resultado);
  } catch (error) {
    responderError(res, error);
  }
};

const guardar = async (req, res) => {
  try {
    const resultado = await descuentosDecimosService.guardarDescuentosDecimos(
      req.body,
      req.user.id,
    );
    res.json(resultado);
  } catch (error) {
    responderError(res, error);
  }
};

module.exports = { guardar, obtener };
