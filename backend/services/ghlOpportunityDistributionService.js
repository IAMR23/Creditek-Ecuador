const { Op } = require("sequelize");
const { sequelize } = require("../config/db");
const Configuracion = require("../models/GhlRepartoConfiguracion");
const Ejecucion = require("../models/GhlRepartoEjecucion");
const Detalle = require("../models/GhlRepartoEjecucionDetalle");
const Usuario = require("../models/Usuario");
const ghl = require("./ghlService");

const TIME_ZONE = "America/Guayaquil";
const ID_RE = /^[A-Za-z0-9_-]{2,100}$/;
const ACTIVE_STATES = Object.freeze(["running", "pause_requested", "cancel_requested"]);
const BLOCKING_STATES = Object.freeze([...ACTIVE_STATES, "paused"]);
const TERMINAL_STATES = Object.freeze(["completed", "partial", "failed", "cancelled", "interrupted", "skipped"]);
const requestedStaleMs = Number(process.env.GHL_EXECUTION_STALE_MS);
const STALE_AFTER_MS = Number.isFinite(requestedStaleMs) && requestedStaleMs >= 60_000 ? requestedStaleMs : 180_000;
const activeAbortControllers = new Map();
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const serviceError = (code, message, statusCode = 409) => Object.assign(new Error(message), { code, statusCode });
const sanitize = (value) => String(value || "Error no especificado")
  .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [REDACTED]")
  .replace(/token[=:]\s*[^\s,;]+/gi, "token=[REDACTED]").slice(0, 1000);
const idOf = (item) => ghl.toId(item?.id || item?._id);
const assignedToOf = (item) => ghl.toId(item?.assignedTo || item?.userId || item?.ownerId) || null;

function uniqueUsers(users = []) {
  const seen = new Set();
  return users.map((user) => ({ id: String(user?.id || "").trim(), name: String(user?.name || "").trim(), email: String(user?.email || "").trim() }))
    .filter((user) => user.id && !seen.has(user.id) && seen.add(user.id));
}

function buildAssignments(opportunities, users, startIndex = 0) {
  const validUsers = uniqueUsers(users);
  if (validUsers.length < 2) throw serviceError("GHL_USERS_MINIMUM", "Seleccione al menos dos usuarios GHL distintos", 400);
  const sorted = [...opportunities].sort((a, b) => {
    const dateDiff = new Date(ghl.getOpportunityDateValue(a) || 0) - new Date(ghl.getOpportunityDateValue(b) || 0);
    return dateDiff || idOf(a).localeCompare(idOf(b));
  });
  const offset = ((Number(startIndex) || 0) % validUsers.length + validUsers.length) % validUsers.length;
  const rotated = validUsers.slice(offset).concat(validUsers.slice(0, offset));
  return sorted.map((opportunity, index) => ({ opportunity, user: rotated[index % rotated.length] }));
}

const eligibleOpportunities = (opportunities, mode) => mode === "unassigned"
  ? opportunities.filter((item) => !assignedToOf(item)) : [...opportunities];

function classifyCurrentOpportunity(opportunity, configRow) {
  if (ghl.getOpportunityStageId(opportunity) !== configRow.stageId || ghl.getOpportunityPipelineId(opportunity) !== configRow.pipelineId) return "STAGE_CHANGED";
  if (configRow.modo === "unassigned" && assignedToOf(opportunity)) return "OWNER_CHANGED";
  return null;
}

const executionState = (assigned, errors) => errors ? (assigned ? "partial" : "failed") : "completed";

function localScheduleParts(date = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23", weekday: "short",
  }).formatToParts(date).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  const dayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return { day: dayMap[parts.weekday], time: `${parts.hour}:${parts.minute}`, window: `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`, date: `${parts.year}-${parts.month}-${parts.day}` };
}

function opportunityDateRange(now = new Date()) {
  return { fechaInicio: localScheduleParts(new Date(now.getTime() - 86_400_000)).date, fechaFin: localScheduleParts(now).date };
}

async function getClient(signal) {
  const config = ghl.getGhlConfig({ requirePipelineId: false });
  const rawClient = ghl.createGhlClient(config);
  return { config, client: signal ? { request: (options) => rawClient.request({ ...options, signal }) } : rawClient };
}

async function getCatalogs() {
  const { config, client } = await getClient();
  const [pipelines, users] = await Promise.all([ghl.fetchPipelines(client, config), ghl.fetchAllAssignableUsers(client, config)]);
  return { pipelines, users: users.filter((user) => user?.deleted !== true && user?.active !== false && user?.status !== "inactive") };
}

const pipelineStages = (pipeline) => (pipeline?.stages || pipeline?.pipelineStages || []).filter(Boolean);

async function validateInput(input) {
  const days = [...new Set((input.diasSemana || []).map(Number))].filter((day) => Number.isInteger(day) && day >= 0 && day <= 6).sort();
  const users = uniqueUsers(input.usuariosGhl);
  if (!ID_RE.test(String(input.pipelineId || "")) || !ID_RE.test(String(input.stageId || ""))) throw serviceError("INVALID_PIPELINE_STAGE", "Pipeline y etapa son obligatorios", 400);
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(input.hora || "")) throw serviceError("INVALID_TIME", "La hora debe usar formato HH:mm", 400);
  if (!days.length) throw serviceError("INVALID_DAYS", "Seleccione al menos un dia", 400);
  if (input.zonaHoraria && input.zonaHoraria !== TIME_ZONE) throw serviceError("INVALID_TIMEZONE", `La zona horaria debe ser ${TIME_ZONE}`, 400);
  if (!["unassigned", "all"].includes(input.modo)) throw serviceError("INVALID_MODE", "Modo de reparto invalido", 400);
  if (users.length < 2 || users.some((user) => !ID_RE.test(user.id))) throw serviceError("GHL_USERS_MINIMUM", "Seleccione al menos dos usuarios GHL validos y distintos", 400);
  const catalogs = await getCatalogs();
  const pipeline = catalogs.pipelines.find((item) => idOf(item) === String(input.pipelineId));
  const stage = pipelineStages(pipeline).find((item) => idOf(item) === String(input.stageId));
  const activeById = new Map(catalogs.users.map((user) => [idOf(user), user]));
  if (!pipeline || !stage) throw serviceError("INVALID_PIPELINE_STAGE", "El pipeline o la etapa ya no existe en GHL", 400);
  if (users.some((user) => !activeById.has(user.id))) throw serviceError("INVALID_GHL_USERS", "Uno o mas usuarios no estan activos o no pertenecen a GHL", 400);
  return { nombre: String(input.nombre || `${pipeline.name} - ${stage.name}`).trim().slice(0, 160), pipelineId: idOf(pipeline), pipelineNombre: String(pipeline.name || "Pipeline"), stageId: idOf(stage), stageNombre: String(stage.name || "Etapa"), hora: input.hora, zonaHoraria: TIME_ZONE, diasSemana: days, modo: input.modo, usuariosGhl: users.map((user) => { const raw = activeById.get(user.id); return { id: user.id, name: raw?.name || `${raw?.firstName || ""} ${raw?.lastName || ""}`.trim() || user.name, email: raw?.email || user.email || "" }; }), activo: input.activo !== false };
}

async function allStageOpportunities(configRow, client, config, now = new Date()) {
  const all = await ghl.fetchOpportunitiesByStatus(client, { ...config, pipelineId: configRow.pipelineId }, "open", opportunityDateRange(now));
  return all.filter((item) => ghl.getOpportunityPipelineId(item) === configRow.pipelineId && ghl.getOpportunityStageId(item) === configRow.stageId);
}

async function preview(configRow) {
  const now = new Date();
  const { config, client } = await getClient();
  const found = await allStageOpportunities(configRow, client, config, now);
  const eligible = eligibleOpportunities(found, configRow.modo);
  const assignments = buildAssignments(eligible, configRow.usuariosGhl, configRow.indiceSiguienteUsuario);
  return { totalEncontradas: found.length, totalElegibles: eligible.length, totalOmitidas: found.length - eligible.length, rangoFechas: opportunityDateRange(now), usuarios: configRow.usuariosGhl.map((user) => ({ ...user, cantidad: assignments.filter((item) => item.user.id === user.id).length })) };
}

class ExecutionControlSignal extends Error {
  constructor(state) { super(state); this.code = "EXECUTION_CONTROL_REQUESTED"; this.controlState = state; }
}

async function requestWithRetry(client, options, maxRetries = 3, beforeRetry = null) {
  for (let attempt = 0; ; attempt += 1) {
    try { return await ghl.requestGhl(client, { ...options, beforeRetry }); } catch (error) {
      if (error.upstreamStatus !== 429 || attempt >= maxRetries) throw error;
      if (beforeRetry) await beforeRetry();
      await sleep(Math.min(error.retryAfterMs ?? 500 * (2 ** attempt), 10000));
    }
  }
}

async function acquireLock(configId) {
  const connection = await sequelize.connectionManager.getConnection();
  const result = await connection.query("SELECT pg_try_advisory_lock(hashtext($1)) AS locked", [`ghl-reparto:${configId}`]);
  if (!result.rows?.[0]?.locked) { await sequelize.connectionManager.releaseConnection(connection); return null; }
  return connection;
}

async function releaseLock(connection, configId) {
  if (!connection) return;
  try { await connection.query("SELECT pg_advisory_unlock(hashtext($1))", [`ghl-reparto:${configId}`]); }
  finally { await sequelize.connectionManager.releaseConnection(connection); }
}

const heartbeatExpired = (run, now = Date.now()) => {
  const heartbeat = new Date(run.heartbeatAt || run.startedAt || 0).getTime();
  return ACTIVE_STATES.includes(run.estado) && Number.isFinite(heartbeat) && now - heartbeat > STALE_AFTER_MS;
};

async function currentControlState(runId) {
  const current = await Ejecucion.findByPk(runId, { attributes: ["id", "estado"] });
  if (!current) throw serviceError("EXECUTION_NOT_FOUND", "Ejecucion no encontrada", 404);
  if (["pause_requested", "cancel_requested"].includes(current.estado)) throw new ExecutionControlSignal(current.estado);
  return current.estado;
}

const isRetryableError = (error) => ["GHL_CONNECTION_ERROR", "GHL_RATE_LIMITED", "GHL_UPSTREAM_ERROR"].includes(error?.code) || Number(error?.upstreamStatus) >= 500;

async function refreshCounters(run) {
  const details = await Detalle.findAll({ where: { ejecucionId: run.id }, attributes: ["estado"], raw: true });
  const count = (state) => details.filter((detail) => detail.estado === state).length;
  const assigned = count("assigned");
  const errors = count("error");
  const processed = details.filter((detail) => detail.estado !== "pending").length;
  const skipped = count("skipped") + count("cancelled");
  await run.update({ totalAsignadas: assigned, totalErrores: errors, totalOmitidas: Math.max(0, run.totalEncontradas - run.totalElegibles) + skipped, processedCount: processed, heartbeatAt: new Date() });
  return { assigned, errors, processed, skipped };
}

async function finalizeControl(run, state) {
  if (state === "pause_requested") {
    await refreshCounters(run);
    await run.update({ estado: "paused", pausedAt: new Date(), heartbeatAt: new Date() });
    return "paused";
  }
  await Detalle.update({ estado: "cancelled", retryable: false, errorCode: "EXECUTION_CANCELLED", errorMessage: "Omitida por cancelacion de la ejecucion" }, { where: { ejecucionId: run.id, estado: { [Op.in]: ["pending", "error"] } } });
  await refreshCounters(run);
  await run.update({ estado: "cancelled", cancelledAt: new Date(), finishedAt: new Date(), heartbeatAt: new Date() });
  return "cancelled";
}

async function processOneDetail(run, configRow, detail, client) {
  await currentControlState(run.id);
  await detail.update({ attemptCount: Number(detail.attemptCount || 0) + 1 });
  try {
    const currentPayload = await requestWithRetry(client, { method: "GET", url: `/opportunities/${encodeURIComponent(detail.opportunityId)}` }, 3, () => currentControlState(run.id));
    const current = currentPayload.opportunity || currentPayload.data || currentPayload;
    const currentOwner = assignedToOf(current);
    if (currentOwner === detail.newAssignedTo) {
      await detail.update({ estado: "assigned", retryable: false, previousAssignedTo: detail.previousAssignedTo || currentOwner, errorCode: null, errorMessage: null });
      return;
    }
    const skipCode = classifyCurrentOpportunity(current, configRow);
    if (skipCode) {
      await detail.update({ estado: "skipped", retryable: false, previousAssignedTo: currentOwner, errorCode: skipCode, errorMessage: skipCode === "STAGE_CHANGED" ? "La oportunidad abandono la etapa antes de asignarla" : "La oportunidad fue asignada manualmente durante la ejecucion" });
      return;
    }
    await requestWithRetry(client, { method: "PUT", url: `/opportunities/${encodeURIComponent(detail.opportunityId)}`, data: { assignedTo: detail.newAssignedTo } }, 3, () => currentControlState(run.id));
    try {
      await detail.update({ estado: "assigned", retryable: false, previousAssignedTo: currentOwner, errorCode: null, errorMessage: null });
    } catch (storageError) {
      const verificationPayload = await requestWithRetry(client, { method: "GET", url: `/opportunities/${encodeURIComponent(detail.opportunityId)}` }, 3, () => currentControlState(run.id));
      const verification = verificationPayload.opportunity || verificationPayload.data || verificationPayload;
      if (assignedToOf(verification) !== detail.newAssignedTo) throw storageError;
      await detail.update({ estado: "assigned", retryable: false, previousAssignedTo: currentOwner, errorCode: null, errorMessage: null });
    }
  } catch (error) {
    if (error.controlState) throw error;
    const state = await Ejecucion.findByPk(run.id, { attributes: ["estado"] });
    if (["pause_requested", "cancel_requested"].includes(state?.estado)) throw new ExecutionControlSignal(state.estado);
    await detail.update({ estado: "error", retryable: isRetryableError(error), errorCode: error.code || "GHL_UPDATE_ERROR", errorMessage: sanitize(error.message) });
  } finally { await refreshCounters(run); }
}

async function processPlan(run, configRow, client) {
  try {
    await currentControlState(run.id);
    const details = await Detalle.findAll({ where: { ejecucionId: run.id, [Op.or]: [{ estado: "pending" }, { estado: "error", retryable: true }] }, order: [["id", "ASC"]] });
    for (const detail of details) {
      await currentControlState(run.id);
      await processOneDetail(run, configRow, detail, client);
      await currentControlState(run.id);
    }
    const counters = await refreshCounters(run);
    await run.update({ estado: executionState(counters.assigned, counters.errors), finishedAt: new Date(), heartbeatAt: new Date() });
    return run.reload();
  } catch (error) {
    if (error.controlState) { await finalizeControl(run, error.controlState); return run.reload(); }
    throw error;
  }
}

async function createPlan(run, configRow, client, config, runDate) {
  const found = await allStageOpportunities(configRow, client, config, runDate);
  const eligible = eligibleOpportunities(found, configRow.modo);
  const assignments = buildAssignments(eligible, configRow.usuariosGhl, configRow.indiceSiguienteUsuario);
  await run.update({ totalEncontradas: found.length, totalElegibles: eligible.length, totalOmitidas: found.length - eligible.length, heartbeatAt: new Date() });
  if (assignments.length) await Detalle.bulkCreate(assignments.map(({ opportunity, user }) => ({ ejecucionId: run.id, opportunityId: idOf(opportunity), previousAssignedTo: assignedToOf(opportunity), newAssignedTo: user.id, estado: "pending", retryable: true })), { ignoreDuplicates: true });
  return eligible.length;
}

async function blockingExecution(configId, excludeId = null, transaction = null) {
  const where = { configuracionId: configId, estado: { [Op.in]: BLOCKING_STATES } };
  if (excludeId) where.id = { [Op.ne]: excludeId };
  return Ejecucion.findOne({ where, transaction, lock: transaction ? transaction.LOCK.UPDATE : undefined });
}

async function interruptStaleForConfig(configId) {
  const cutoff = new Date(Date.now() - STALE_AFTER_MS);
  const stale = await Ejecucion.findOne({ where: { configuracionId: configId, estado: { [Op.in]: ACTIVE_STATES }, [Op.or]: [{ heartbeatAt: { [Op.lt]: cutoff } }, { heartbeatAt: null, startedAt: { [Op.lt]: cutoff } }] } });
  if (!stale) return false;
  await Detalle.update({ estado: "cancelled", retryable: false, errorCode: "EXECUTION_INTERRUPTED", errorMessage: "No procesada porque la ejecucion fue interrumpida" }, { where: { ejecucionId: stale.id, estado: "pending" } });
  await refreshCounters(stale);
  await stale.update({ estado: "interrupted", finishedAt: new Date(), errorGeneral: "Ejecucion interrumpida: heartbeat vencido y proceso no disponible" });
  return true;
}

async function execute(configRow, { type = "manual", userId = null, scheduledFor = null, window = null } = {}) {
  const lock = await acquireLock(configRow.id);
  if (!lock) return { skipped: true, reason: "Ya existe una ejecucion activa", code: "EXECUTION_ALREADY_ACTIVE" };
  let run;
  try {
    await interruptStaleForConfig(configRow.id);
    const blocking = await blockingExecution(configRow.id);
    if (blocking) return { skipped: true, reason: blocking.estado === "paused" ? "Existe una ejecucion pausada; reanudela o cancelela antes de iniciar otra" : "Ya existe una ejecucion activa", code: "EXECUTION_ALREADY_ACTIVE" };
    try {
      run = await Ejecucion.create({ configuracionId: configRow.id, tipo: type, scheduledFor, ventanaProgramada: window, startedAt: new Date(), heartbeatAt: new Date(), estado: "running", pipelineNombre: configRow.pipelineNombre, stageNombre: configRow.stageNombre, ejecutadoPorId: userId });
    } catch (error) {
      if (error.name === "SequelizeUniqueConstraintError") return { skipped: true, reason: "Esta ventana programada ya fue procesada o existe una ejecucion activa", code: "EXECUTION_ALREADY_ACTIVE" };
      throw error;
    }
    const controller = new AbortController();
    activeAbortControllers.set(String(run.id), controller);
    const { config, client } = await getClient(controller.signal);
    const eligibleCount = await createPlan(run, configRow, client, config, scheduledFor || new Date());
    await currentControlState(run.id);
    const result = await processPlan(run, configRow, client);
    if (["completed", "partial"].includes(result.estado)) {
      const remainder = eligibleCount % configRow.usuariosGhl.length;
      await configRow.update({ indiceSiguienteUsuario: (configRow.indiceSiguienteUsuario + remainder) % configRow.usuariosGhl.length });
    }
    return result;
  } catch (error) {
    if (run) {
      const fresh = await Ejecucion.findByPk(run.id).catch(() => null);
      if (["pause_requested", "cancel_requested"].includes(fresh?.estado)) { await finalizeControl(fresh, fresh.estado); return fresh.reload(); }
      const counters = await refreshCounters(run).catch(() => ({ assigned: Number(run.totalAsignadas || 0) }));
      await run.update({ finishedAt: new Date(), estado: counters.assigned ? "partial" : "failed", heartbeatAt: new Date(), errorGeneral: sanitize(error.message) }).catch(() => {});
    }
    throw error;
  } finally {
    if (run) activeAbortControllers.delete(String(run.id));
    await releaseLock(lock, configRow.id);
  }
}

async function transitionLocked(id, handler) {
  return sequelize.transaction(async (transaction) => {
    const run = await Ejecucion.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!run) throw serviceError("EXECUTION_NOT_FOUND", "Ejecucion no encontrada", 404);
    return handler(run, transaction);
  });
}

async function requestPause(id) {
  return transitionLocked(id, async (run, transaction) => {
    if (["pause_requested", "paused"].includes(run.estado)) throw serviceError("EXECUTION_ALREADY_PAUSED", "La pausa ya fue solicitada o la ejecucion ya esta pausada");
    if (TERMINAL_STATES.includes(run.estado)) throw serviceError("EXECUTION_ALREADY_FINISHED", "La ejecucion ya finalizo");
    if (run.estado !== "running") throw serviceError("EXECUTION_NOT_PAUSABLE", "La ejecucion no se puede pausar en su estado actual");
    await run.update({ estado: "pause_requested", pauseRequestedAt: new Date() }, { transaction });
    return run;
  });
}

async function requestCancel(id) {
  const initial = await Ejecucion.findByPk(id);
  if (!initial) throw serviceError("EXECUTION_NOT_FOUND", "Ejecucion no encontrada", 404);
  if (initial.estado === "cancel_requested") throw serviceError("EXECUTION_CANCEL_REQUESTED", "La cancelacion ya fue solicitada");
  if (!BLOCKING_STATES.includes(initial.estado)) {
    if (TERMINAL_STATES.includes(initial.estado)) throw serviceError("EXECUTION_ALREADY_FINISHED", "La ejecucion ya finalizo");
    throw serviceError("EXECUTION_NOT_CANCELLABLE", "La ejecucion no se puede cancelar en su estado actual");
  }
  if (initial.estado !== "paused") {
    const run = await transitionLocked(id, async (current, transaction) => {
      if (current.estado === "cancel_requested") throw serviceError("EXECUTION_CANCEL_REQUESTED", "La cancelacion ya fue solicitada");
      if (!ACTIVE_STATES.includes(current.estado)) throw serviceError("EXECUTION_ALREADY_FINISHED", "La ejecucion ya no esta activa");
      await current.update({ estado: "cancel_requested", cancelRequestedAt: new Date() }, { transaction });
      return current;
    });
    activeAbortControllers.get(String(id))?.abort();
    return run;
  }
  const lock = await acquireLock(initial.configuracionId);
  if (!lock) throw serviceError("EXECUTION_ALREADY_ACTIVE", "La ejecucion esta siendo procesada; intente nuevamente");
  try {
    const run = await transitionLocked(id, async (run, transaction) => {
      if (run.estado !== "paused") throw serviceError("EXECUTION_NOT_CANCELLABLE", "La ejecucion cambio de estado");
      await run.update({ estado: "cancel_requested", cancelRequestedAt: new Date() }, { transaction });
      return run;
    });
    await finalizeControl(run, "cancel_requested");
    return run.reload();
  } finally { await releaseLock(lock, initial.configuracionId); }
}

async function resume(id) {
  const initial = await Ejecucion.findByPk(id);
  if (!initial) throw serviceError("EXECUTION_NOT_FOUND", "Ejecucion no encontrada", 404);
  if (TERMINAL_STATES.includes(initial.estado)) throw serviceError("EXECUTION_ALREADY_FINISHED", "La ejecucion ya finalizo");
  if (initial.estado !== "paused") throw serviceError("EXECUTION_NOT_RESUMABLE", "Solo una ejecucion pausada puede reanudarse");
  const lock = await acquireLock(initial.configuracionId);
  if (!lock) throw serviceError("EXECUTION_ALREADY_ACTIVE", "Existe otro proceso activo para esta configuracion");
  try {
    const run = await transitionLocked(id, async (current, transaction) => {
      if (current.estado !== "paused") throw serviceError("EXECUTION_NOT_RESUMABLE", "La ejecucion ya no esta pausada");
      if (await blockingExecution(current.configuracionId, current.id, transaction)) throw serviceError("EXECUTION_ALREADY_ACTIVE", "Existe otra ejecucion activa para esta configuracion");
      await current.update({ estado: "running", resumedAt: new Date(), pausedAt: null, heartbeatAt: new Date() }, { transaction });
      return current;
    });
    const configRow = await Configuracion.findByPk(run.configuracionId);
    if (!configRow) throw serviceError("CONFIGURATION_NOT_FOUND", "La configuracion de esta ejecucion ya no existe", 404);
    const controller = new AbortController();
    activeAbortControllers.set(String(run.id), controller);
    const { client } = await getClient(controller.signal);
    return await processPlan(run, configRow, client);
  } catch (error) {
    const run = await Ejecucion.findByPk(id).catch(() => null);
    if (run?.estado === "running") {
      const counters = await refreshCounters(run).catch(() => ({ assigned: Number(run.totalAsignadas || 0) }));
      await run.update({ estado: counters.assigned ? "partial" : "failed", finishedAt: new Date(), errorGeneral: sanitize(error.message), heartbeatAt: new Date() }).catch(() => {});
    }
    throw error;
  } finally {
    activeAbortControllers.delete(String(id));
    await releaseLock(lock, initial.configuracionId);
  }
}

async function isExecutionStale(run) {
  if (!heartbeatExpired(run)) return false;
  const lock = await acquireLock(run.configuracionId);
  if (!lock) return false;
  await releaseLock(lock, run.configuracionId);
  return true;
}

async function forceFinishStale(id) {
  const initial = await Ejecucion.findByPk(id);
  if (!initial) throw serviceError("EXECUTION_NOT_FOUND", "Ejecucion no encontrada", 404);
  if (TERMINAL_STATES.includes(initial.estado) || initial.estado === "paused") throw serviceError("EXECUTION_ALREADY_FINISHED", "La ejecucion no esta activa");
  if (!heartbeatExpired(initial)) throw serviceError("EXECUTION_NOT_STALE", "La ejecucion mantiene un heartbeat saludable");
  const lock = await acquireLock(initial.configuracionId);
  if (!lock) throw serviceError("EXECUTION_NOT_STALE", "La ejecucion aun tiene un proceso activo");
  try {
    const run = await transitionLocked(id, async (current, transaction) => {
      if (!heartbeatExpired(current)) throw serviceError("EXECUTION_NOT_STALE", "La ejecucion ya no esta atascada");
      await current.update({ estado: "cancel_requested", cancelRequestedAt: new Date() }, { transaction });
      return current;
    });
    await Detalle.update({ estado: "cancelled", retryable: false, errorCode: "EXECUTION_INTERRUPTED", errorMessage: "No procesada porque la ejecucion fue interrumpida" }, { where: { ejecucionId: run.id, estado: { [Op.in]: ["pending", "error"] } } });
    await refreshCounters(run);
    await run.update({ estado: "interrupted", finishedAt: new Date(), heartbeatAt: new Date(), errorGeneral: "Ejecucion finalizada administrativamente por heartbeat vencido" });
    return run.reload();
  } finally { await releaseLock(lock, initial.configuracionId); }
}

async function recoverStaleRuns() {
  const cutoff = new Date(Date.now() - STALE_AFTER_MS);
  const candidates = await Ejecucion.findAll({ where: { estado: { [Op.in]: ACTIVE_STATES }, [Op.or]: [{ heartbeatAt: { [Op.lt]: cutoff } }, { heartbeatAt: null, startedAt: { [Op.lt]: cutoff } }] } });
  for (const run of candidates) {
    try { await forceFinishStale(run.id); }
    catch (error) { if (error.code !== "EXECUTION_NOT_STALE") console.error("No se pudo recuperar ejecucion GHL", { ejecucionId: run.id, code: error.code, message: sanitize(error.message) }); }
  }
}

async function listExecutions(query = {}) {
  const where = query.configuracionId ? { configuracionId: query.configuracionId } : {};
  const rows = await Ejecucion.findAll({ where, include: [{ model: Usuario, as: "ejecutadoPor", attributes: ["id", "nombre", "email"] }], order: [["startedAt", "DESC"]], limit: Math.min(Number(query.limit) || 50, 100) });
  return Promise.all(rows.map(async (run) => ({ ...run.toJSON(), isStale: await isExecutionStale(run) })));
}

module.exports = {
  TIME_ZONE, ACTIVE_STATES, BLOCKING_STATES, TERMINAL_STATES, STALE_AFTER_MS,
  uniqueUsers, buildAssignments, eligibleOpportunities, classifyCurrentOpportunity,
  executionState, localScheduleParts, opportunityDateRange, heartbeatExpired, sanitize,
  getCatalogs, pipelineStages, validateInput, preview, requestWithRetry, acquireLock,
  releaseLock, refreshCounters, processOneDetail, processPlan, execute, requestPause,
  requestCancel, resume, isExecutionStale, forceFinishStale, listExecutions, recoverStaleRuns,
};
