const service = require("../../services/sancionesConfiguracionService");
const responder = (res, error) => res.status(error.statusCode || 500).json({ message: error.message || "Error al procesar sanciones" });
const wrap = (fn) => async (req, res) => { try { await fn(req, res); } catch (error) { responder(res, error); } };
exports.listar = wrap(async (req, res) => res.json(await service.listarSanciones(req.query)));
exports.obtener = wrap(async (req, res) => res.json(await service.obtenerSancion(req.params.id)));
exports.crear = wrap(async (req, res) => res.status(201).json(await service.crearSancion(req.body)));
exports.actualizar = wrap(async (req, res) => res.json(await service.actualizarSancion(req.params.id, req.body)));
exports.desactivar = wrap(async (req, res) => res.json(await service.desactivarSancion(req.params.id)));
