const service = require("../../services/rolDescuentosCreditekService");
const manejar = (operacion, status = 200) => async (req, res) => {
  try {
    res.status(status).json(await operacion(req));
  } catch (error) {
    res.status(error.statusCode || 500).json({
      message: error.statusCode ? error.message : "No se pudo procesar el rol de descuentos Creditek",
    });
  }
};
module.exports = {
  obtener: manejar((req) => service.obtener(req.query)),
  crear: manejar((req) => service.crear(req.body, req.user.id), 201),
  actualizar: manejar((req) => service.actualizar(req.params.id, req.body, req.user.id)),
  cambiarEstado: manejar((req) => service.actualizar(req.params.id, req.body, req.user.id, true)),
};
