const service = require("../../services/egresosCreditekTiposService");
const responder = (accion) => async (req, res) => {
  try { await accion(req, res); } catch (error) { res.status(error.statusCode || 500).json({ message: error.message || "No se pudieron procesar los tipos" }); }
};
module.exports = {
  listar: responder(async (req, res) => res.json({ tipos: await service.listar(req.params.seccion) })),
  crear: responder(async (req, res) => res.status(201).json({ tipo: await service.crear(req.params.seccion, req.body, req.user.id) })),
  actualizar: responder(async (req, res) => res.json({ tipo: await service.actualizar(req.params.seccion, req.params.tipoId, req.body, req.user.id) })),
  desactivar: responder(async (req, res) => res.json({ tipo: await service.actualizar(req.params.seccion, req.params.tipoId, { activo: false }, req.user.id) })),
};
