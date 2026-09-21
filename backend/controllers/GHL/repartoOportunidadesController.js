const Configuracion = require("../../models/GhlRepartoConfiguracion");
const Ejecucion = require("../../models/GhlRepartoEjecucion");
const service = require("../../services/ghlOpportunityDistributionService");
const advisorService = require("../../services/ghlAdvisorAvailabilityService");
const { Op } = require("sequelize");

const respondError = (res, error) => res.status(error.statusCode || 500).json({ ok: false, code: error.code || "GHL_REPARTO_ERROR", message: service.sanitize(error.message) });

async function pipelines(req, res) {
  try { const data = await service.getCatalogs(); res.json({ ok: true, pipelines: data.pipelines }); } catch (error) { respondError(res, error); }
}
async function stages(req, res) {
  try { const data = await service.getCatalogs(); const pipeline = data.pipelines.find((p) => String(p.id || p._id) === req.params.pipelineId); if (!pipeline) return res.status(404).json({ ok: false, message: "Pipeline no encontrado" }); res.json({ ok: true, stages: service.pipelineStages(pipeline) }); } catch (error) { respondError(res, error); }
}
async function realtimeConfiguration(req, res) {
  try {
    const result = await service.getRealtimeDistributionConfiguration();
    res.json({ ok: true, ...result });
  } catch (error) { respondError(res, error); }
}
async function saveRealtimeConfiguration(req, res) {
  try {
    const configuracion = await service.saveRealtimeDistributionConfiguration(req.body, req.user.id);
    const review = await service.scheduleRealtimeQueueReview({ trigger: "config-update" });
    res.json({
      ok: true,
      configuracion,
      review,
      message: "Configuracion del reparto en tiempo real guardada correctamente",
    });
  } catch (error) { respondError(res, error); }
}
async function realtimeConfigurationState(req, res) {
  try {
    const configuracion = await service.setRealtimeDistributionState(req.body.activo === true, req.user.id);
    const review = configuracion.activo
      ? await service.scheduleRealtimeQueueReview({ trigger: "config-state" })
      : null;
    res.json({
      ok: true,
      configuracion,
      review,
      message: configuracion.activo
        ? "Reparto en tiempo real activado"
        : "Reparto en tiempo real desactivado",
    });
  } catch (error) { respondError(res, error); }
}
async function users(req, res) {
  try { const data = await service.getCatalogs(); res.json({ ok: true, users: data.users.map((u) => ({ id: u.id || u._id, name: u.name || `${u.firstName || ""} ${u.lastName || ""}`.trim(), email: u.email || "" })) }); } catch (error) { respondError(res, error); }
}
async function list(req, res) { try {
  const where = req.query.tipo === "refresco"
    ? { modo: "refresh_non_management" }
    : req.query.tipo === "reparto"
      ? { modo: { [Op.in]: ["unassigned", "all"] } }
      : {};
  res.json({ ok: true, configuraciones: await Configuracion.findAll({ where, order: [["createdAt", "DESC"]] }) });
} catch (error) { respondError(res, error); } }
async function get(req, res) { try { const row = await Configuracion.findByPk(req.params.id); if (!row) return res.status(404).json({ ok: false, message: "Configuracion no encontrada" }); res.json({ ok: true, configuracion: row }); } catch (error) { respondError(res, error); } }
async function create(req, res) { try { const data = await service.validateInput(req.body); const row = await Configuracion.create({ ...data, creadoPorId: req.user.id, actualizadoPorId: req.user.id }); res.status(201).json({ ok: true, configuracion: row }); } catch (error) { respondError(res, error); } }
async function update(req, res) { try { const row = await Configuracion.findByPk(req.params.id); if (!row) return res.status(404).json({ ok: false, message: "Configuracion no encontrada" }); const data = await service.validateInput(req.body); await row.update({ ...data, actualizadoPorId: req.user.id }); res.json({ ok: true, configuracion: row }); } catch (error) { respondError(res, error); } }
async function state(req, res) { try { const row = await Configuracion.findByPk(req.params.id); if (!row) return res.status(404).json({ ok: false, message: "Configuracion no encontrada" }); await row.update({ activo: req.body.activo === true, actualizadoPorId: req.user.id }); res.json({ ok: true, configuracion: row }); } catch (error) { respondError(res, error); } }
async function preview(req, res) { try { const row = await Configuracion.findByPk(req.params.id); if (!row) return res.status(404).json({ ok: false, message: "Configuracion no encontrada" }); res.json({ ok: true, preview: await service.preview(row) }); } catch (error) { respondError(res, error); } }
async function previewInput(req, res) { try { const data = await service.validateInput(req.body); res.json({ ok: true, preview: await service.preview({ ...data, indiceSiguienteUsuario: 0 }) }); } catch (error) { respondError(res, error); } }
async function execute(req, res) { try { if (req.body.confirm !== true) return res.status(400).json({ ok: false, code: "EXECUTION_CONFIRMATION_REQUIRED", message: "Debe confirmar explicitamente la ejecucion" }); const row = await Configuracion.findByPk(req.params.id); if (!row) return res.status(404).json({ ok: false, code: "CONFIGURATION_NOT_FOUND", message: "Configuracion no encontrada" }); const result = await service.execute(row, { type: "manual", userId: req.user.id }); res.status(result.skipped ? 409 : 200).json({ ok: !result.skipped, code: result.code, ejecucion: result, message: result.reason }); } catch (error) { respondError(res, error); } }
async function history(req, res) { try { res.json({ ok: true, ejecuciones: await service.listExecutions(req.query) }); } catch (error) { respondError(res, error); } }
async function execution(req, res) { try { const row = await Ejecucion.findByPk(req.params.id, { include: [{ association: "detalles" }, { association: "ejecutadoPor", attributes: ["id", "nombre", "email"] }] }); if (!row) return res.status(404).json({ ok: false, message: "Ejecucion no encontrada" }); res.json({ ok: true, ejecucion: row }); } catch (error) { respondError(res, error); } }
async function pause(req, res) { try { const row = await service.requestPause(req.params.id); res.json({ ok: true, ejecucion: row, message: "Pausa solicitada; se detendra despues de la peticion actual" }); } catch (error) { respondError(res, error); } }
async function resume(req, res) { try { const row = await service.resume(req.params.id); res.json({ ok: true, ejecucion: row }); } catch (error) { respondError(res, error); } }
async function cancel(req, res) { try { const row = await service.requestCancel(req.params.id); res.json({ ok: true, ejecucion: row, message: row.estado === "cancelled" ? "Ejecucion cancelada" : "Cancelacion solicitada" }); } catch (error) { respondError(res, error); } }
async function forceFinishStale(req, res) { try { const row = await service.forceFinishStale(req.params.id); res.json({ ok: true, ejecucion: row, message: "Ejecucion atascada finalizada" }); } catch (error) { respondError(res, error); } }

async function myAvailability(req, res) {
  try {
    res.json({
      ok: true,
      disponibilidad: await advisorService.getMyAvailability(req.user.id),
    });
  } catch (error) { respondError(res, error); }
}

async function setMyAvailability(req, res) {
  try {
    const disponibilidad = await advisorService.changeAvailability({
      usuarioId: req.user.id,
      estado: req.body.estado,
      actorId: req.user.id,
      motivoCambio: "asesor",
    });
    if (disponibilidad.estado === "ACTIVO") {
      await service.scheduleRealtimeQueueReview({ trigger: "play" });
    }
    res.json({ ok: true, disponibilidad });
  } catch (error) {
    respondError(res, error);
  }
}

async function advisorAvailability(req, res) {
  try {
    res.json({
      ok: true,
      asesores: await advisorService.listAdvisorAvailability(),
    });
  } catch (error) { respondError(res, error); }
}

async function advisorAutoPauseConfiguration(req, res) {
  try {
    res.json({
      ok: true,
      configuracion: await advisorService.getAutoPauseConfiguration({ force: true }),
    });
  } catch (error) { respondError(res, error); }
}

async function saveAdvisorAutoPauseConfiguration(req, res) {
  try {
    const configuracion = await advisorService.saveAutoPauseConfiguration(
      { horaPausaAutomatica: req.body.horaPausaAutomatica },
      req.user.id,
    );
    res.json({
      ok: true,
      configuracion,
      message: "Hora de pausa automatica guardada correctamente",
    });
  } catch (error) { respondError(res, error); }
}

async function saveAdvisorAssociation(req, res) {
  try {
    const disponibilidad = await advisorService.saveAssociation({
      usuarioId: Number(req.params.usuarioId),
      ghlUserId: req.body.ghlUserId,
      actorId: req.user.id,
    });
    res.json({ ok: true, disponibilidad });
  } catch (error) { respondError(res, error); }
}

async function setAdvisorAvailability(req, res) {
  try {
    const disponibilidad = await advisorService.changeAvailability({
      usuarioId: Number(req.params.usuarioId),
      estado: req.body.estado,
      actorId: req.user.id,
      motivoCambio: "administrador",
    });
    if (disponibilidad.estado === "ACTIVO") {
      await service.scheduleRealtimeQueueReview({ trigger: "admin-play" });
    }
    res.json({ ok: true, disponibilidad });
  } catch (error) { respondError(res, error); }
}

async function advisorManagementReport(req, res) {
  try {
    res.json({
      ok: true,
      fecha: req.query.fecha || advisorService.localDate(),
      gestores: await advisorService.getAdvisorManagementReport({ fecha: req.query.fecha }),
    });
  } catch (error) { respondError(res, error); }
}

async function setAdvisorManagementAvailability(req, res) {
  try {
    const disponibilidad = await advisorService.changeAvailability({
      usuarioId: Number(req.params.usuarioId),
      estado: req.body.estado,
      actorId: req.user.id,
      motivoCambio: "administrador",
    });
    if (disponibilidad.estado === "ACTIVO") {
      await service.scheduleRealtimeQueueReview({ trigger: "admin-play" });
    }
    res.json({ ok: true, disponibilidad });
  } catch (error) { respondError(res, error); }
}

module.exports = { pipelines, stages, realtimeConfiguration, saveRealtimeConfiguration, realtimeConfigurationState, users, list, get, create, update, state, preview, previewInput, execute, history, execution, pause, resume, cancel, forceFinishStale, myAvailability, setMyAvailability, advisorAvailability, advisorAutoPauseConfiguration, saveAdvisorAutoPauseConfiguration, saveAdvisorAssociation, setAdvisorAvailability, advisorManagementReport, setAdvisorManagementAvailability };
