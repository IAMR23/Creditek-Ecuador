const Programacion = require("../models/GhlWorkflowProgramacion");
const Ejecucion = require("../models/GhlWorkflowEjecucion");
const ghl = require("./ghlService");

const TIME_ZONE = "America/Guayaquil";
const ID_RE = /^[A-Za-z0-9_-]{2,100}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const serviceError = (code, message, statusCode = 400) =>
  Object.assign(new Error(message), { code, statusCode });

const sanitize = (value) => String(value || "Error no especificado")
  .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [REDACTED]")
  .replace(/(authorization|cookie|token|secret)\s*[=:]\s*[^\s,;]+/gi, "$1=[REDACTED]")
  .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[EMAIL_REDACTED]")
  .replace(/(?:\+?\d[\s().-]*){7,}/g, "[NUMBER_REDACTED]")
  .slice(0, 500);

const idOf = (value) => ghl.toId(value?.id || value?._id || value);
const nameOf = (value, fallback) => String(value?.name || value?.title || value?.label || fallback || "").trim();

async function getCatalogs() {
  const config = ghl.getGhlConfig({ requirePipelineId: false });
  const client = ghl.createGhlClient(config);
  const [rawPipelines, rawWorkflows] = await Promise.all([
    ghl.fetchPipelines(client, config),
    ghl.fetchWorkflows(client, config),
  ]);
  const pipelines = rawPipelines.map((pipeline) => ({
    id: idOf(pipeline),
    name: nameOf(pipeline, "Pipeline sin nombre"),
    stages: (Array.isArray(pipeline?.stages) ? pipeline.stages : []).map((stage) => ({
      id: idOf(stage),
      name: nameOf(stage, "Etapa sin nombre"),
    })).filter((stage) => stage.id),
  })).filter((pipeline) => pipeline.id);
  const workflows = rawWorkflows.map((workflow) => ({
    id: idOf(workflow),
    name: nameOf(workflow, "Workflow sin nombre"),
    status: String(workflow?.status || "").trim().toLowerCase(),
    active: ghl.isWorkflowActive(workflow),
  })).filter((workflow) => workflow.id && workflow.active);
  return { pipelines, workflows };
}

function normalizeDays(days) {
  if (!Array.isArray(days)) return [];
  return [...new Set(days.map(Number))].sort((a, b) => a - b);
}

async function validateInput(input = {}, { requireActive = null } = {}) {
  const nombre = String(input.nombre || "").trim();
  const pipelineId = idOf(input.pipelineId);
  const workflowId = idOf(input.workflowId);
  const stageIds = [...new Set((Array.isArray(input.stageIds) ? input.stageIds : []).map(idOf).filter(Boolean))];
  const diasSemana = normalizeDays(input.diasSemana);
  const hora = String(input.hora || "").trim();
  const zonaHoraria = String(input.zonaHoraria || TIME_ZONE).trim();
  const activo = input.activo !== false;

  if (!nombre) throw serviceError("GHL_WORKFLOW_NAME_REQUIRED", "El nombre es obligatorio");
  if (nombre.length > 160) throw serviceError("GHL_WORKFLOW_NAME_TOO_LONG", "El nombre admite hasta 160 caracteres");
  if (!ID_RE.test(pipelineId)) throw serviceError("GHL_WORKFLOW_PIPELINE_REQUIRED", "Seleccione un pipeline valido");
  if (!stageIds.length) throw serviceError("GHL_WORKFLOW_STAGES_REQUIRED", "Seleccione al menos una etapa");
  if (stageIds.length !== (Array.isArray(input.stageIds) ? input.stageIds.length : 0)) {
    throw serviceError("GHL_WORKFLOW_DUPLICATE_STAGES", "No se permiten etapas duplicadas o invalidas");
  }
  if (!ID_RE.test(workflowId)) throw serviceError("GHL_WORKFLOW_REQUIRED", "Seleccione un workflow valido");
  if (!TIME_RE.test(hora)) throw serviceError("GHL_WORKFLOW_INVALID_TIME", "La hora debe tener formato HH:mm");
  if (!diasSemana.length || diasSemana.some((day) => !Number.isInteger(day) || day < 0 || day > 6)) {
    throw serviceError("GHL_WORKFLOW_INVALID_DAYS", "Seleccione dias validos entre 0 y 6");
  }
  if (zonaHoraria !== TIME_ZONE) {
    throw serviceError("GHL_WORKFLOW_INVALID_TIMEZONE", `La zona horaria debe ser ${TIME_ZONE}`);
  }

  const { pipelines, workflows } = await getCatalogs();
  const pipeline = pipelines.find((item) => item.id === pipelineId);
  if (!pipeline) throw serviceError("GHL_WORKFLOW_PIPELINE_NOT_FOUND", "El pipeline ya no existe en HighLevel", 409);
  const stageMap = new Map(pipeline.stages.map((stage) => [stage.id, stage]));
  if (stageIds.some((id) => !stageMap.has(id))) {
    throw serviceError("GHL_WORKFLOW_STAGE_NOT_FOUND", "Una o mas etapas no pertenecen al pipeline", 409);
  }
  const workflow = workflows.find((item) => item.id === workflowId);
  if (!workflow) throw serviceError("GHL_WORKFLOW_NOT_AVAILABLE", "El workflow no existe o no esta activo", 409);
  if ((requireActive === true || activo) && (!stageIds.length || !workflow.active)) {
    throw serviceError("GHL_WORKFLOW_INCOMPLETE", "No se puede activar una programacion incompleta", 409);
  }

  return {
    nombre,
    pipelineId,
    pipelineNombre: pipeline.name,
    stageIds,
    stageNombres: stageIds.map((id) => ({ id, nombre: stageMap.get(id).name })),
    workflowId,
    workflowNombre: workflow.name,
    hora,
    diasSemana,
    zonaHoraria: TIME_ZONE,
    permitirReingreso: input.permitirReingreso === true,
    activo,
  };
}

function localParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date).reduce((acc, part) => {
    if (part.type !== "literal") acc[part.type] = part.value;
    return acc;
  }, {});
  const localDate = `${parts.year}-${parts.month}-${parts.day}`;
  const day = new Date(`${localDate}T00:00:00Z`).getUTCDay();
  return { date: localDate, time: `${parts.hour}:${parts.minute}`, day };
}

function nextRun(programacion, now = new Date()) {
  const current = localParts(now);
  for (let offset = 0; offset < 8; offset += 1) {
    const candidate = new Date(`${current.date}T12:00:00-05:00`);
    candidate.setUTCDate(candidate.getUTCDate() + offset);
    const local = localParts(candidate);
    if (!programacion.diasSemana.includes(local.day)) continue;
    if (offset === 0 && programacion.hora <= current.time) continue;
    return `${local.date}T${programacion.hora}:00-05:00`;
  }
  return null;
}

async function list() {
  const rows = await Programacion.findAll({ order: [["createdAt", "DESC"]] });
  return Promise.all(rows.map(async (row) => {
    const last = await Ejecucion.findOne({ where: { configuracionId: row.id }, order: [["scheduledFor", "DESC"]] });
    return { ...row.toJSON(), proximaEjecucion: row.activo ? nextRun(row) : null, ultimaEjecucion: last?.toJSON() || null };
  }));
}

module.exports = {
  TIME_ZONE,
  sanitize,
  serviceError,
  getCatalogs,
  validateInput,
  localParts,
  nextRun,
  list,
};
