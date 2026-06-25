const nominaService = require("../../services/nominaService");

const responderError = (res, error) => {
  const status = error.statusCode || 500;
  res.status(status).json({
    message: error.message || "Error al procesar nomina",
  });
};

const listarNomina = async (req, res) => {
  try {
    const usarUsuarioAutenticado = ["true", "1", "si", "sí"].includes(
      String(req.query.mio || "").trim().toLowerCase(),
    );
    const registros = await nominaService.listarNomina({
      ...req.query,
      usuarioId: usarUsuarioAutenticado ? req.user.id : req.query.usuarioId,
    });
    res.json(registros);
  } catch (error) {
    responderError(res, error);
  }
};

const obtenerPorUsuario = async (req, res) => {
  try {
    const registros = await nominaService.obtenerNominaPorUsuario(req.params.usuarioId);
    res.json(registros);
  } catch (error) {
    responderError(res, error);
  }
};

const crearSiNoExiste = async (req, res) => {
  try {
    const registro = await nominaService.crearSiNoExiste(req.params.usuarioAgenciaId);
    res.status(201).json(registro);
  } catch (error) {
    responderError(res, error);
  }
};

const actualizarNomina = async (req, res) => {
  try {
    const registro = await nominaService.actualizarNomina(req.params.id, req.body);
    res.json(registro);
  } catch (error) {
    responderError(res, error);
  }
};

module.exports = {
  listarNomina,
  obtenerPorUsuario,
  crearSiNoExiste,
  actualizarNomina,
};
