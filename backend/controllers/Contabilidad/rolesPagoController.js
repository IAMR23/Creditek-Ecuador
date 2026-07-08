const rolesPagoService = require("../../services/rolesPagoService");

const responderError = (res, error) => {
  const status = error.statusCode || 500;
  res.status(status).json({
    message: error.message || "Error al procesar roles de pago",
  });
};

const listarRolesPago = async (req, res) => {
  try {
    const roles = await rolesPagoService.listarRolesPago(req.query);
    res.json(roles);
  } catch (error) {
    responderError(res, error);
  }
};

const obtenerRolPago = async (req, res) => {
  try {
    const rol = await rolesPagoService.obtenerRolPago(req.params.id);
    res.json(rol);
  } catch (error) {
    responderError(res, error);
  }
};

const crearRolPago = async (req, res) => {
  try {
    const rol = await rolesPagoService.crearRolPago(req.body);
    res.status(201).json(rol);
  } catch (error) {
    responderError(res, error);
  }
};

const actualizarRolPago = async (req, res) => {
  try {
    const rol = await rolesPagoService.actualizarRolPago(req.params.id, req.body);
    res.json(rol);
  } catch (error) {
    responderError(res, error);
  }
};

const desactivarRolPago = async (req, res) => {
  try {
    const rol = await rolesPagoService.desactivarRolPago(req.params.id);
    res.json(rol);
  } catch (error) {
    responderError(res, error);
  }
};

module.exports = {
  listarRolesPago,
  obtenerRolPago,
  crearRolPago,
  actualizarRolPago,
  desactivarRolPago,
};
