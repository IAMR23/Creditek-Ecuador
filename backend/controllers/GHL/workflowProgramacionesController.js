const Programacion = require("../../models/GhlWorkflowProgramacion");
const Ejecucion = require("../../models/GhlWorkflowEjecucion");
const configurationService = require("../../services/ghlWorkflowConfigurationService");
const executionService = require("../../services/ghlWorkflowExecutionService");

const respondError = (res, error) => res.status(error.statusCode || 500).json({
  ok: false,
  code: error.code || "GHL_WORKFLOW_PROGRAMACION_ERROR",
  message: configurationService.sanitize(error.message),
});

async function pipelines(req, res) {
  try {
    const { pipelines: rows } = await configurationService.getCatalogs();
    res.json({ ok: true, pipelines: rows.map(({ stages, ...pipeline }) => pipeline) });
  } catch (error) { respondError(res, error); }
}

async function stages(req, res) {
  try {
    const { pipelines: rows } = await configurationService.getCatalogs();
    const pipeline = rows.find((item) => item.id === req.params.pipelineId);
    if (!pipeline) return res.status(404).json({ ok: false, code: "PIPELINE_NOT_FOUND", message: "Pipeline no encontrado" });
    return res.json({ ok: true, stages: pipeline.stages });
  } catch (error) { return respondError(res, error); }
}

async function workflows(req, res) {
  try {
    const { workflows: rows } = await configurationService.getCatalogs();
    res.json({ ok: true, workflows: rows });
  } catch (error) { respondError(res, error); }
}

async function list(req, res) {
  try { res.json({ ok: true, programaciones: await configurationService.list() }); }
  catch (error) { respondError(res, error); }
}

async function get(req, res) {
  try {
    const row = await Programacion.findByPk(req.params.id);
    if (!row) return res.status(404).json({ ok: false, code: "CONFIGURATION_NOT_FOUND", message: "Programacion no encontrada" });
    return res.json({ ok: true, programacion: { ...row.toJSON(), proximaEjecucion: row.activo ? configurationService.nextRun(row) : null } });
  } catch (error) { return respondError(res, error); }
}

async function create(req, res) {
  try {
    const data = await configurationService.validateInput(req.body);
    const row = await Programacion.create({ ...data, creadoPorId: req.user.id, actualizadoPorId: req.user.id });
    res.status(201).json({ ok: true, programacion: row });
  } catch (error) { respondError(res, error); }
}

async function update(req, res) {
  try {
    const row = await Programacion.findByPk(req.params.id);
    if (!row) return res.status(404).json({ ok: false, code: "CONFIGURATION_NOT_FOUND", message: "Programacion no encontrada" });
    const data = await configurationService.validateInput(req.body);
    await row.update({ ...data, actualizadoPorId: req.user.id });
    return res.json({ ok: true, programacion: row });
  } catch (error) { return respondError(res, error); }
}

async function state(req, res) {
  try {
    const row = await Programacion.findByPk(req.params.id);
    if (!row) return res.status(404).json({ ok: false, code: "CONFIGURATION_NOT_FOUND", message: "Programacion no encontrada" });
    const activo = req.body.activo === true;
    if (activo) await configurationService.validateInput({ ...row.toJSON(), activo: true }, { requireActive: true });
    await row.update({ activo, actualizadoPorId: req.user.id });
    return res.json({ ok: true, programacion: row, message: activo ? "Programacion activada" : "Programacion pausada" });
  } catch (error) { return respondError(res, error); }
}

async function previewInput(req, res) {
  try {
    const data = await configurationService.validateInput(req.body);
    res.json({ ok: true, preview: await executionService.preview(data) });
  } catch (error) { respondError(res, error); }
}

async function preview(req, res) {
  try {
    const row = await Programacion.findByPk(req.params.id);
    if (!row) return res.status(404).json({ ok: false, code: "CONFIGURATION_NOT_FOUND", message: "Programacion no encontrada" });
    return res.json({ ok: true, preview: await executionService.preview(row) });
  } catch (error) { return respondError(res, error); }
}

async function history(req, res) {
  try { res.json({ ok: true, ejecuciones: await executionService.listExecutions(req.query) }); }
  catch (error) { respondError(res, error); }
}

async function execution(req, res) {
  try {
    const row = await Ejecucion.findByPk(req.params.id, {
      include: [
        { association: "configuracion", attributes: ["id", "nombre", "pipelineNombre", "workflowNombre"] },
        { association: "detalles", order: [["id", "ASC"]] },
      ],
    });
    if (!row) return res.status(404).json({ ok: false, code: "EXECUTION_NOT_FOUND", message: "Ejecucion no encontrada" });
    return res.json({ ok: true, ejecucion: row });
  } catch (error) { return respondError(res, error); }
}

module.exports = { pipelines, stages, workflows, list, get, create, update, state, previewInput, preview, history, execution };
