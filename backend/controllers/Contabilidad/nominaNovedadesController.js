const service = require('../../services/nominaNovedadesService');
const responder = (accion) => async (req, res) => {
  try { res.json(await accion(req)); }
  catch (error) { res.status(error.statusCode || 500).json({ message: error.statusCode ? error.message : 'No se pudo procesar la novedad de nómina' }); }
};
module.exports = {
  listar: responder((req) => service.listar(req.params.usuarioId)),
  crear: responder((req) => service.guardar(req.body, req.user.id)),
  actualizar: responder((req) => service.guardar(req.body, req.user.id, req.params.id)),
  vistaPrevia: responder((req) => service.vistaPrevia(req.body)),
};
