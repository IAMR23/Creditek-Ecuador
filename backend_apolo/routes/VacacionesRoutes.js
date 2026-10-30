const express = require("express");
const { Op } = require("sequelize");
const Agencia = require("../models/Agencia");
const Usuario = require("../models/Usuario");
const UsuarioAgencia = require("../models/UsuarioAgencia");
const VacacionSolicitud = require("../models/VacacionSolicitud");
const VacacionSolicitudPeriodo = require("../models/VacacionSolicitudPeriodo");
const VacacionHistorial = require("../models/VacacionHistorial");
const VacacionPago = require("../models/VacacionPago");
const VacacionPagoPeriodo = require("../models/VacacionPagoPeriodo");
const { normalizeRoleName } = require("../middleware/auth");
const { estadoTemporal, generarPeriodosAniversario, hoyGuayaquil } = require("../services/vacacionesDomain");
const service = require("../services/vacacionesService");

const router = express.Router();
const requireAdmin = (req, res, next) => normalizeRoleName(req.user?.rol?.nombre) === "ADMIN"
  ? next()
  : res.status(403).json({ code: "ADMIN_REQUIRED", message: "Vacaciones es de acceso exclusivo para ADMIN." });
router.use(requireAdmin);

const asyncRoute = (handler) => async (req, res) => {
  try { await handler(req, res); } catch (error) {
    if (error.name === "SequelizeUniqueConstraintError") return res.status(409).json({ code: "OPERACION_DUPLICADA", message: "La operación ya fue registrada." });
    if (error.original?.code === "40001") return res.status(409).json({ code: "CONCURRENCIA", message: "Los datos cambiaron al mismo tiempo; recargue e intente nuevamente." });
    console.error("Error en módulo Vacaciones:", error);
    return res.status(error.status || 500).json({ code: error.code || "VACACIONES_ERROR", message: error.message || "Error en el módulo de vacaciones", ...error.extra });
  }
};

const includeSolicitud = [
  { model: Usuario, as: "colaborador", attributes: ["id", "nombre", "fechaIngreso", "fechaSalida"] },
  { model: Agencia, as: "agencia", attributes: ["id", "nombre", "tipo"] },
  { model: Usuario, as: "reemplazo", attributes: ["id", "nombre"], required: false },
  { model: VacacionSolicitudPeriodo, as: "periodosOrigen" },
  { model: VacacionHistorial, as: "historial", required: false },
];

router.get("/catalogos", asyncRoute(async (_req, res) => {
  const [usuarios, agencias] = await Promise.all([
    Usuario.findAll({
      where: { activo: true }, attributes: ["id", "nombre", "fechaIngreso", "fechaSalida"],
      include: [{ model: Agencia, as: "agencias", attributes: ["id", "nombre", "tipo"], through: { where: { activo: true }, attributes: [] }, required: false }],
      order: [["nombre", "ASC"]],
    }),
    Agencia.findAll({ where: { activo: true }, attributes: ["id", "nombre", "tipo"], order: [["tipo", "ASC"], ["nombre", "ASC"]] }),
  ]);
  res.json({ usuarios, agencias, conteo: "DIAS_CALENDARIO_INCLUSIVOS", zonaHoraria: "America/Guayaquil" });
}));

router.get("/periodos", asyncRoute(async (req, res) => {
  if (!req.query.usuarioId) return res.status(400).json({ message: "usuarioId es obligatorio." });
  res.json(await service.obtenerSaldos(req.query.usuarioId));
}));
router.get("/periodos-propuestos/:usuarioId", asyncRoute(async (req, res) => {
  const usuario = await Usuario.findByPk(req.params.usuarioId, { attributes: ["id", "nombre", "fechaIngreso"] });
  if (!usuario) return res.status(404).json({ message: "Colaborador no encontrado." });
  if (!usuario.fechaIngreso) return res.status(400).json({ code: "FECHA_INGRESO_REQUERIDA", message: "El colaborador no tiene fecha de ingreso registrada en Usuarios." });
  const registrados = await service.obtenerSaldos(usuario.id);
  const clavesRegistradas = new Set(registrados.map((item) => `${item.fechaInicio}:${item.fechaFin}`));
  const propuestas = generarPeriodosAniversario(usuario.fechaIngreso).map((item) => ({
    ...item,
    registrado: clavesRegistradas.has(`${item.fechaInicio}:${item.fechaFin}`),
  }));
  res.json({ usuario, propuestas });
}));
router.get("/saldos/:usuarioId", asyncRoute(async (req, res) => res.json(await service.obtenerSaldos(req.params.usuarioId))));
router.post("/periodos", asyncRoute(async (req, res) => res.status(201).json(await service.crearPeriodo(req.body, req.user))));
router.post("/periodos/:id/ajustes", asyncRoute(async (req, res) => res.status(201).json(await service.crearAjuste(req.params.id, req.body, req.user))));

router.get("/solicitudes", asyncRoute(async (req, res) => {
  const where = {};
  if (req.query.usuarioId) where.usuarioId = req.query.usuarioId;
  if (req.query.agenciaId) where.agenciaId = req.query.agenciaId;
  if (req.query.estado) where.estado = String(req.query.estado).toUpperCase();
  if (req.query.desde || req.query.hasta) where.fechaInicio = { ...(req.query.hasta ? { [Op.lte]: req.query.hasta } : {}) };
  if (req.query.desde) where.fechaFin = { [Op.gte]: req.query.desde };
  const solicitudes = await VacacionSolicitud.findAll({ where, include: includeSolicitud, order: [["fechaInicio", "DESC"], ["id", "DESC"]] });
  const hoy = hoyGuayaquil();
  res.json(solicitudes.map((item) => ({ ...item.toJSON(), estadoTemporal: estadoTemporal(item, hoy) })));
}));

router.post("/solicitudes", asyncRoute(async (req, res) => {
  const solicitud = await service.crearSolicitud(req.body, req.user);
  const coincidencias = await VacacionSolicitud.count({ where: { id: { [Op.ne]: solicitud.id }, agenciaId: solicitud.agenciaId, estado: "APROBADA", fechaInicio: { [Op.lte]: solicitud.fechaFin }, fechaFin: { [Op.gte]: solicitud.fechaInicio } } });
  res.status(201).json({ solicitud, advertencias: coincidencias ? [`Coincide con ${coincidencias} compañero(s) de la unidad; revise la cobertura.`] : [] });
}));
router.post("/solicitudes/:id/aprobar", asyncRoute(async (req, res) => res.json(await service.aprobarSolicitud(req.params.id, req.body, req.user))));
router.post("/solicitudes/:id/rechazar", asyncRoute(async (req, res) => res.json(await service.rechazarSolicitud(req.params.id, req.body, req.user))));
router.post("/solicitudes/:id/cancelar", asyncRoute(async (req, res) => res.json(await service.cancelarSolicitud(req.params.id, req.body, req.user))));
router.post("/solicitudes/:id/revisar", asyncRoute(async (req, res) => res.status(201).json(await service.revisarSolicitud(req.params.id, req.body, req.user))));
router.post("/solicitudes/:id/procesar-consumo", asyncRoute(async (req, res) => res.json(await service.procesarConsumo(req.params.id, req.user))));
router.post("/procesar-consumos", asyncRoute(async (req, res) => res.json(await service.procesarConsumosPendientes(req.body || {}, req.user))));

router.get("/calendario", asyncRoute(async (req, res) => {
  const desde = req.query.desde; const hasta = req.query.hasta;
  if (!desde || !hasta) return res.status(400).json({ message: "desde y hasta son obligatorios." });
  const where = { estado: "APROBADA", fechaInicio: { [Op.lte]: hasta }, fechaFin: { [Op.gte]: desde } };
  if (req.query.usuarioId) where.usuarioId = req.query.usuarioId;
  if (req.query.agenciaId) where.agenciaId = req.query.agenciaId;
  const items = await VacacionSolicitud.findAll({ where, include: includeSolicitud.slice(0, 3), order: [["fechaInicio", "ASC"]] });
  const conflictos = new Set();
  for (let i = 0; i < items.length; i += 1) for (let j = i + 1; j < items.length; j += 1) {
    const a = items[i]; const b = items[j];
    if (Number(a.agenciaId) === Number(b.agenciaId) && Number(a.usuarioId) !== Number(b.usuarioId) && a.fechaInicio <= b.fechaFin && a.fechaFin >= b.fechaInicio) {
      conflictos.add(String(a.id)); conflictos.add(String(b.id));
    }
  }
  res.json(items.map((item) => {
    const json = item.toJSON();
    return { ...json, estadoTemporal: estadoTemporal(item), advertenciaCobertura: conflictos.has(String(item.id)) };
  }));
}));

router.get("/pagos", asyncRoute(async (req, res) => {
  const where = {};
  if (req.query.usuarioId) where.usuarioId = req.query.usuarioId;
  if (req.query.estado) where.estado = String(req.query.estado).toUpperCase();
  res.json(await VacacionPago.findAll({
    where,
    include: [
      { model: Usuario, as: "colaborador", attributes: ["id", "nombre", "fechaSalida"] },
      { model: VacacionPagoPeriodo, as: "periodosOrigen" },
    ], order: [["createdAt", "DESC"]],
  }));
}));
router.post("/pagos", asyncRoute(async (req, res) => res.status(201).json(await service.crearPago(req.body, req.user))));
router.post("/pagos/:id/aprobar", asyncRoute(async (req, res) => res.json(await service.aprobarPago(req.params.id, req.user))));
router.post("/pagos/:id/confirmar", asyncRoute(async (req, res) => res.json(await service.confirmarPago(req.params.id, req.body, req.user))));
router.post("/pagos/:id/anular", asyncRoute(async (req, res) => res.json(await service.anularPago(req.params.id, req.body, req.user))));

module.exports = router;
module.exports.requireAdmin = requireAdmin;
