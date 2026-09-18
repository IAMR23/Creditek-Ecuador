const { Op } = require("sequelize");
const { sequelize } = require("../config/db");
const Configuracion = require("../models/GhlRepartoConfiguracion");
const Ejecucion = require("../models/GhlRepartoEjecucion");
const Detalle = require("../models/GhlRepartoEjecucionDetalle");
const TiempoRealAsignacion = require("../models/GhlRepartoTiempoRealAsignacion");
const Usuario = require("../models/Usuario");
const ghl = require("./ghlService");
const advisorAvailability = require("./ghlAdvisorAvailabilityService");
const distributionLock = require("./ghlDistributionExecutionLock");
const realtimeReviewCoordinator = require("./ghlRealtimeReviewCoordinator");

const TIME_ZONE = "America/Guayaquil";
const DEFAULT_MAX_PENDING_PER_ADVISOR = 10;
const MAX_PENDING_PER_ADVISOR = 1000;
const DEFAULT_DB_OPERATION_MS = 15_000;
const REALTIME_LOCK_SCOPE = "realtime:whatsapp-facebook";
const ID_RE = /^[A-Za-z0-9_-]{2,100}$/;
const ACTIVE_STATES = Object.freeze(["running", "pause_requested", "cancel_requested"]);
const BLOCKING_STATES = Object.freeze([...ACTIVE_STATES, "paused"]);
const TERMINAL_STATES = Object.freeze(["completed", "partial", "failed", "cancelled", "interrupted", "skipped"]);
const requestedStaleMs = Number(process.env.GHL_EXECUTION_STALE_MS);
const STALE_AFTER_MS = Number.isFinite(requestedStaleMs) && requestedStaleMs >= 60_000 ? requestedStaleMs : 180_000;
const activeAbortControllers = new Map();
let realtimeNextUserIndex = 0;
const sleep = (ms, signal = null) => new Promise((resolve, reject) => {
  if (signal?.aborted) return reject(signal.reason);
  const timer = setTimeout(() => {
    signal?.removeEventListener("abort", onAbort);
    resolve();
  }, ms);
  const onAbort = () => {
    clearTimeout(timer);
    reject(signal.reason);
  };
  signal?.addEventListener("abort", onAbort, { once: true });
});
const serviceError = (code, message, statusCode = 409) => Object.assign(new Error(message), { code, statusCode });
const sanitize = (value) => String(value || "Error no especificado")
  .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [REDACTED]")
  .replace(/(authorization|cookie|token|secret)\s*[=:]\s*[^\s,;]+/gi, "$1=[REDACTED]")
  .replace(/((?:phone|telefono|cedula|email|firstName|lastName|contactName|customerName|clientName|nombreCliente|message|body)\s*[=:]\s*)[^,;\]}]+/gi, "$1[REDACTED]")
  .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[EMAIL_REDACTED]")
  .replace(/(?:\+?\d[\s().-]*){7,}/g, "[NUMBER_REDACTED]")
  .slice(0, 500);
const idOf = (item) => ghl.toId(item?.id || item?._id);
const assignedToOf = (item) => ghl.toId(item?.assignedTo || item?.userId || item?.ownerId) || null;

function uniqueUsers(users = []) {
  const seen = new Set();
  return users.map((user) => ({ id: String(user?.id || "").trim(), name: String(user?.name || "").trim(), email: String(user?.email || "").trim() }))
    .filter((user) => user.id && !seen.has(user.id) && seen.add(user.id));
}

function buildAssignments(opportunities, users, startIndex = 0) {
  const validUsers = uniqueUsers(users);
  if (!validUsers.length) throw serviceError("GHL_USERS_REQUIRED", "No hay asesores activos para el reparto", 409);
  const sorted = [...opportunities].sort((a, b) => {
    const dateDiff = new Date(ghl.getOpportunityDateValue(a) || 0) - new Date(ghl.getOpportunityDateValue(b) || 0);
    return dateDiff || idOf(a).localeCompare(idOf(b));
  });
  const offset = ((Number(startIndex) || 0) % validUsers.length + validUsers.length) % validUsers.length;
  const rotated = validUsers.slice(offset).concat(validUsers.slice(0, offset));
  return sorted.map((opportunity, index) => ({ opportunity, user: rotated[index % rotated.length] }));
}

function currentLoadsByAdvisor(opportunities, users) {
  const loads = new Map(uniqueUsers(users).map((user) => [user.id, 0]));
  opportunities.forEach((opportunity) => {
    const ownerId = assignedToOf(opportunity);
    if (ownerId && loads.has(ownerId)) loads.set(ownerId, loads.get(ownerId) + 1);
  });
  return loads;
}

function buildCapacityAssignments(opportunities, users, currentLoads, maxPending, startIndex = 0) {
  const validUsers = uniqueUsers(users);
  if (!validUsers.length) throw serviceError("GHL_USERS_REQUIRED", "No hay asesores activos para el reparto", 409);
  const limit = Number(maxPending);
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_PENDING_PER_ADVISOR) {
    throw serviceError("INVALID_MAX_PENDING", `El limite por asesor debe ser un entero entre 1 y ${MAX_PENDING_PER_ADVISOR}`, 400);
  }
  const sorted = [...opportunities].sort((a, b) => {
    const dateDiff = new Date(ghl.getOpportunityDateValue(a) || 0) - new Date(ghl.getOpportunityDateValue(b) || 0);
    return dateDiff || idOf(a).localeCompare(idOf(b));
  });
  const loadOf = (userId) => Number(currentLoads instanceof Map ? currentLoads.get(userId) : currentLoads?.[userId]) || 0;
  const advisorStates = validUsers.map((user, index) => ({
    ...user,
    index,
    cargaActual: Math.max(0, loadOf(user.id)),
    cargaProvisional: Math.max(0, loadOf(user.id)),
    cantidadPlanificada: 0,
  }));
  let cursor = ((Number(startIndex) || 0) % validUsers.length + validUsers.length) % validUsers.length;
  const assignments = [];

  for (const opportunity of sorted) {
    const candidates = advisorStates.filter((advisor) => advisor.cargaProvisional < limit);
    if (!candidates.length) break;
    const minimumLoad = Math.min(...candidates.map((advisor) => advisor.cargaProvisional));
    const tiedIds = new Set(candidates.filter((advisor) => advisor.cargaProvisional === minimumLoad).map((advisor) => advisor.id));
    let selected;
    for (let offset = 0; offset < advisorStates.length; offset += 1) {
      const candidate = advisorStates[(cursor + offset) % advisorStates.length];
      if (tiedIds.has(candidate.id)) { selected = candidate; break; }
    }
    assignments.push({ opportunity, user: { id: selected.id, name: selected.name, email: selected.email } });
    selected.cargaProvisional += 1;
    selected.cantidadPlanificada += 1;
    cursor = (selected.index + 1) % advisorStates.length;
  }

  return {
    assignments,
    nextUserIndex: cursor,
    totalPendientesCapacidad: sorted.length - assignments.length,
    advisors: advisorStates.map(({ index, cargaProvisional, ...advisor }) => ({
      ...advisor,
      capacidadDisponible: Math.max(0, limit - advisor.cargaActual),
      cargaResultante: cargaProvisional,
    })),
  };
}

const eligibleOpportunities = (opportunities, mode) => mode === "unassigned"
  ? opportunities.filter((item) => !assignedToOf(item)) : [...opportunities];

function classifyCurrentOpportunity(opportunity, configRow) {
  const stageId = ghl.getOpportunityStageId(opportunity);
  const invalidStage = configRow.modo === "refresh_non_management"
    ? stageId === configRow.stageId
    : stageId !== configRow.stageId;
  if (invalidStage || ghl.getOpportunityPipelineId(opportunity) !== configRow.pipelineId) return "STAGE_CHANGED";
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

function opportunityTodayRange(now = new Date()) {
  const date = localScheduleParts(now).date;
  return { fechaInicio: date, fechaFin: date };
}

async function getClient(signal, existingConfig = null) {
  const config = existingConfig || ghl.getGhlConfig({ requirePipelineId: false });
  const rawClient = ghl.createGhlClient(config);
  return {
    config,
    client: signal
      ? { signal, request: (options) => rawClient.request({ ...options, signal }) }
      : rawClient,
  };
}

const throwIfClientAborted = (client) => {
  if (client?.signal?.aborted) throw client.signal.reason;
};

const databaseOperationMs = () => {
  const value = Number(process.env.GHL_REPARTO_DB_OPERATION_MS);
  return Number.isFinite(value) && value >= 1_000 ? value : DEFAULT_DB_OPERATION_MS;
};

const awaitReadWithAbort = (promise, signal, timeoutMs = databaseOperationMs()) => {
  if (signal?.aborted) return Promise.reject(signal.reason);
  return new Promise((resolve, reject) => {
    let timer;
    const cleanup = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    };
    const onAbort = () => {
      cleanup();
      reject(signal.reason);
    };
    signal?.addEventListener("abort", onAbort, { once: true });
    timer = setTimeout(() => {
      cleanup();
      reject(serviceError(
        "GHL_DB_OPERATION_TIMEOUT",
        `La operacion de base de datos excedio ${timeoutMs} ms`,
        503,
      ));
    }, timeoutMs);
    timer.unref?.();
    Promise.resolve(promise).then(resolve, reject).finally(() => {
      cleanup();
    });
  });
};

async function getCatalogs() {
  const { config, client } = await getClient();
  const [pipelines, users] = await Promise.all([ghl.fetchPipelines(client, config), ghl.fetchAllAssignableUsers(client, config)]);
  return { pipelines, users: users.filter((user) => user?.deleted !== true && user?.active !== false && user?.status !== "inactive") };
}

const pipelineStages = (pipeline) => (pipeline?.stages || pipeline?.pipelineStages || []).filter(Boolean);

const normalizeStageName = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

const realtimeStageChannel = (stage) => {
  const name = normalizeStageName(stage?.name || stage?.title || stage?.label);
  if (name.includes("WHATSAPP")) {
    return "whatsapp";
  }
  if (name.includes("FACEBOOK")) {
    return "facebook";
  }
  return null;
};

function realtimeMaxPendingPerAdvisor(env = process.env) {
  const value = Number(env.GHL_REPARTO_MAX_PENDIENTES_POR_ASESOR);
  return Number.isInteger(value) && value >= 1 && value <= MAX_PENDING_PER_ADVISOR
    ? value
    : DEFAULT_MAX_PENDING_PER_ADVISOR;
}

async function getRealtimePipelineContext(client, config) {
  const pipelines = await ghl.fetchPipelines(client, config);
  const configuredPipelineId = ghl.toId(config.pipelineId);
  const pipeline = configuredPipelineId
    ? pipelines.find((item) => idOf(item) === configuredPipelineId)
    : pipelines[0];
  if (configuredPipelineId && !pipeline) {
    throw serviceError(
      "GHL_CONFIGURED_PIPELINE_NOT_FOUND",
      "GHL_PIPELINE_ID no corresponde a un pipeline disponible en la ubicacion configurada",
      502,
    );
  }
  if (!pipeline || !idOf(pipeline)) {
    throw serviceError("GHL_PIPELINE_NOT_FOUND", "GHL no devolvio el pipeline de oportunidades", 502);
  }
  const receivedStages = pipelineStages(pipeline)
    .map((stage) => ({ ...stage, channel: realtimeStageChannel(stage) }));
  const stages = receivedStages.filter((stage) => stage.channel && idOf(stage));
  if (!stages.length) {
    throw serviceError("GHL_REALTIME_STAGES_NOT_FOUND", "GHL no devolvio las etapas WhatsApp o Facebook", 502);
  }
  return {
    pipeline,
    pipelineId: idOf(pipeline),
    stages,
    stageIds: new Set(stages.map(idOf)),
  };
}

const isRealtimeStageOpportunity = (opportunity, context) =>
  ghl.getOpportunityPipelineId(opportunity) === context.pipelineId
  && context.stageIds.has(ghl.getOpportunityStageId(opportunity));

async function fetchRealtimeOpenOpportunities(client, config, context, { onPage = null } = {}) {
  const opportunities = [];
  for (const stage of context.stages) {
    const stageOpportunities = await ghl.fetchOpportunitiesByStatus(
      client,
      {
        ...config,
        pipelineId: context.pipelineId,
        pipelineStageId: idOf(stage),
      },
      "open",
      {},
      { onPage },
    );
    opportunities.push(...stageOpportunities);
  }
  const deduplicated = ghl.dedupeOpportunitiesById(opportunities);
  const eligible = deduplicated.filter((opportunity) =>
    isOpenOpportunity(opportunity) && isRealtimeStageOpportunity(opportunity, context));
  return eligible;
}

async function validateInput(input) {
  const days = [...new Set((input.diasSemana || []).map(Number))].filter((day) => Number.isInteger(day) && day >= 0 && day <= 6).sort();
  const users = uniqueUsers(input.usuariosGhl);
  if (!ID_RE.test(String(input.pipelineId || "")) || !ID_RE.test(String(input.stageId || ""))) throw serviceError("INVALID_PIPELINE_STAGE", "Pipeline y etapa son obligatorios", 400);
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(input.hora || "")) throw serviceError("INVALID_TIME", "La hora debe usar formato HH:mm", 400);
  if (!days.length) throw serviceError("INVALID_DAYS", "Seleccione al menos un dia", 400);
  if (input.zonaHoraria && input.zonaHoraria !== TIME_ZONE) throw serviceError("INVALID_TIMEZONE", `La zona horaria debe ser ${TIME_ZONE}`, 400);
  if (!["unassigned", "all", "refresh_non_management"].includes(input.modo)) throw serviceError("INVALID_MODE", "Modo de reparto invalido", 400);
  const dynamicAdvisors = input.modo === "refresh_non_management";
  if (!dynamicAdvisors && (users.length < 2 || users.some((user) => !ID_RE.test(user.id)))) throw serviceError("GHL_USERS_MINIMUM", "Seleccione al menos dos usuarios GHL validos y distintos", 400);
  const intervaloMinutos = Number(input.intervaloMinutos ?? 1);
  if (!Number.isInteger(intervaloMinutos) || intervaloMinutos < 1 || intervaloMinutos > 60) throw serviceError("INVALID_INTERVAL", "El intervalo debe estar entre 1 y 60 minutos", 400);
  const maxPendientesPorAsesor = Number(input.maxPendientesPorAsesor ?? DEFAULT_MAX_PENDING_PER_ADVISOR);
  if (!Number.isInteger(maxPendientesPorAsesor) || maxPendientesPorAsesor < 1 || maxPendientesPorAsesor > MAX_PENDING_PER_ADVISOR) throw serviceError("INVALID_MAX_PENDING", `El limite por asesor debe ser un entero entre 1 y ${MAX_PENDING_PER_ADVISOR}`, 400);
  const catalogs = await getCatalogs();
  const pipeline = catalogs.pipelines.find((item) => idOf(item) === String(input.pipelineId));
  const stage = pipelineStages(pipeline).find((item) => idOf(item) === String(input.stageId));
  const activeById = new Map(catalogs.users.map((user) => [idOf(user), user]));
  if (!pipeline || !stage) throw serviceError("INVALID_PIPELINE_STAGE", "El pipeline o la etapa ya no existe en GHL", 400);
  if (!dynamicAdvisors && users.some((user) => !activeById.has(user.id))) throw serviceError("INVALID_GHL_USERS", "Uno o mas usuarios no estan activos o no pertenecen a GHL", 400);
  return { nombre: String(input.nombre || `${pipeline.name} - ${stage.name}`).trim().slice(0, 160), pipelineId: idOf(pipeline), pipelineNombre: String(pipeline.name || "Pipeline"), stageId: idOf(stage), stageNombre: String(stage.name || "Etapa"), hora: input.hora, intervaloMinutos, maxPendientesPorAsesor, zonaHoraria: TIME_ZONE, diasSemana: days, modo: input.modo, usuariosGhl: dynamicAdvisors ? [] : users.map((user) => { const raw = activeById.get(user.id); return { id: user.id, name: raw?.name || `${raw?.firstName || ""} ${raw?.lastName || ""}`.trim() || user.name, email: raw?.email || user.email || "" }; }), activo: input.activo !== false };
}

async function allStageOpportunities(configRow, client, config, now = new Date()) {
  if (configRow.modo === "refresh_non_management") {
    const all = await ghl.fetchAllOpportunityStatuses(
      client,
      { ...config, pipelineId: configRow.pipelineId },
      opportunityTodayRange(now),
    );
    return all.filter((item) => ghl.getOpportunityPipelineId(item) === configRow.pipelineId && ghl.getOpportunityStageId(item) !== configRow.stageId);
  }
  const dateRange = configRow.modo === "unassigned" ? {} : opportunityDateRange(now);
  const all = await ghl.fetchOpportunitiesByStatus(client, { ...config, pipelineId: configRow.pipelineId }, "open", dateRange);
  return all.filter((item) => ghl.getOpportunityPipelineId(item) === configRow.pipelineId && ghl.getOpportunityStageId(item) === configRow.stageId);
}

async function advisorsForConfiguration(configRow, currentGhlUsers, now) {
  if (configRow.modo === "refresh_non_management") {
    return advisorAvailability.resolveActiveAdvisors(currentGhlUsers, now);
  }
  return advisorAvailability.resolveConfiguredAdvisors(configRow.usuariosGhl, currentGhlUsers, now);
}

async function preview(configRow) {
  const now = new Date();
  const { config, client } = await getClient();
  const [found, currentGhlUsers] = await Promise.all([
    allStageOpportunities(configRow, client, config, now),
    ghl.fetchAllAssignableUsers(client, config),
  ]);
  const advisors = await advisorsForConfiguration(configRow, currentGhlUsers, now);
  const eligible = eligibleOpportunities(found, configRow.modo);
  const limit = Number(configRow.maxPendientesPorAsesor) || DEFAULT_MAX_PENDING_PER_ADVISOR;
  let assignments = [];
  let activeSummaries = advisors.active.map((user) => ({ ...user, cantidad: 0 }));
  let totalPendientesCapacidad = 0;
  if (advisors.active.length && configRow.modo === "unassigned") {
    const capacityPlan = buildCapacityAssignments(
      eligible,
      advisors.active,
      currentLoadsByAdvisor(found, advisors.active),
      limit,
      configRow.indiceSiguienteUsuario,
    );
    assignments = capacityPlan.assignments;
    totalPendientesCapacidad = capacityPlan.totalPendientesCapacidad;
    activeSummaries = capacityPlan.advisors.map((user) => ({ ...user, cantidad: user.cantidadPlanificada }));
  } else if (advisors.active.length) {
    assignments = buildAssignments(eligible, advisors.active, configRow.indiceSiguienteUsuario);
    activeSummaries = advisors.active.map((user) => ({
      ...user,
      cantidad: assignments.filter((item) => item.user.id === user.id).length,
    }));
  } else if (configRow.modo === "unassigned") {
    totalPendientesCapacidad = eligible.length;
  }
  const inactiveLoads = currentLoadsByAdvisor(found, [...advisors.paused, ...advisors.invalid]);
  const summarizeInactive = (user) => ({
    ...user,
    cargaActual: inactiveLoads.get(user.id) || 0,
    capacidadDisponible: 0,
    cantidadPlanificada: 0,
    cantidad: 0,
  });
  const warning = !advisors.active.length
    ? "No hay asesores en Play; las oportunidades no se modificaran y permaneceran sin propietario"
    : configRow.modo === "unassigned" && eligible.length > 0 && assignments.length === 0
      ? "Todos los asesores en Play alcanzaron el limite; la cola permanecera sin propietario"
      : null;
  return {
    totalEncontradas: found.length,
    totalElegibles: eligible.length,
    totalOmitidas: found.length - eligible.length,
    totalSinPropietario: found.filter((item) => !assignedToOf(item)).length,
    totalConPropietario: found.filter((item) => Boolean(assignedToOf(item))).length,
    totalPorAsignar: assignments.length,
    totalPendientesCapacidad,
    maxPendientesPorAsesor: limit,
    rangoFechas: configRow.modo === "refresh_non_management"
      ? opportunityTodayRange(now)
      : configRow.modo === "unassigned" ? null : opportunityDateRange(now),
    usuariosConfigurados: configRow.modo === "refresh_non_management" ? advisors.active.length + advisors.paused.length + advisors.invalid.length : configRow.usuariosGhl.length,
    usuariosActivos: advisors.active.length,
    usuariosPausados: advisors.paused.length,
    usuariosInvalidos: advisors.invalid.length,
    advertencia: warning,
    usuarios: activeSummaries,
    pausados: advisors.paused.map(summarizeInactive),
    invalidos: advisors.invalid.map(summarizeInactive),
  };
}

class ExecutionControlSignal extends Error {
  constructor(state) { super(state); this.code = "EXECUTION_CONTROL_REQUESTED"; this.controlState = state; }
}

async function requestWithRetry(client, options, maxRetries = 3, beforeRetry = null) {
  for (let attempt = 0; ; attempt += 1) {
    throwIfClientAborted(client);
    try { return await ghl.requestGhl(client, { ...options, beforeRetry, maxRetries: 0 }); } catch (error) {
      if (error.upstreamStatus !== 429 || attempt >= maxRetries) throw error;
      if (beforeRetry) await beforeRetry();
      await sleep(error.retryAfterMs ?? 500 * (2 ** attempt), client.signal);
      if (beforeRetry) await beforeRetry();
    }
  }
}

async function acquireLock(configId) {
  const connection = await distributionLock.acquireConnection();
  try {
    const result = await distributionLock.queryConnection(
      connection,
      "SELECT pg_try_advisory_lock(hashtext($1)) AS locked",
      [`ghl-reparto:${configId}`],
    );
    if (result.rows?.[0]?.locked) return connection;
  } catch (error) {
    if (!error.connectionDestroyed) {
      await sequelize.connectionManager.releaseConnection(connection).catch(() => {});
    }
    throw error;
  }
  await sequelize.connectionManager.releaseConnection(connection);
  return null;
}

async function releaseLock(connection, configId) {
  if (!connection) return;
  let connectionDestroyed = false;
  try {
    await distributionLock.queryConnection(
      connection,
      "SELECT pg_advisory_unlock(hashtext($1))",
      [`ghl-reparto:${configId}`],
    );
  } catch (error) {
    connectionDestroyed = Boolean(error.connectionDestroyed);
    throw error;
  } finally {
    if (!connectionDestroyed) {
      await sequelize.connectionManager.releaseConnection(connection);
    }
  }
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
  const details = await Detalle.findAll({ where: { ejecucionId: run.id }, attributes: ["estado", "errorCode"], raw: true });
  const count = (state) => details.filter((detail) => detail.estado === state).length;
  const skippedByCode = (code) => details.filter((detail) => detail.estado === "skipped" && detail.errorCode === code).length;
  const assigned = count("assigned");
  const errors = count("error");
  const processed = details.filter((detail) => detail.estado !== "pending").length;
  const skipped = count("skipped") + count("cancelled");
  await run.update({
    totalAsignadas: assigned,
    totalErrores: errors,
    totalOmitidas: Math.max(0, run.totalEncontradas - run.totalElegibles) + skipped,
    totalOmitidasCambioEtapa: skippedByCode("STAGE_CHANGED"),
    totalOmitidasAsesorPausado: skippedByCode("ADVISOR_PAUSED"),
    totalOmitidasPropietarioCambiado: skippedByCode("OWNER_CHANGED"),
    totalPendientesCapacidad: Math.max(0, Number(run.totalElegibles || 0) - Number(run.totalPlanificadas || 0)) + skippedByCode("CAPACITY_REACHED"),
    processedCount: processed,
    heartbeatAt: new Date(),
  });
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

async function processOneDetail(run, configRow, detail, client, capacityTracker = null) {
  throwIfClientAborted(client);
  await currentControlState(run.id);
  await detail.update({ attemptCount: Number(detail.attemptCount || 0) + 1 });
  try {
    const advisorStillActive = await advisorAvailability.isGhlUserActiveToday(detail.newAssignedTo);
    const plannedCapacityAvailable = !capacityTracker
      || configRow.modo !== "unassigned"
      || (Number(capacityTracker.loads.get(detail.newAssignedTo)) || 0) < capacityTracker.limit;
    const currentPayload = await requestWithRetry(client, { method: "GET", url: `/opportunities/${encodeURIComponent(detail.opportunityId)}` }, 3, () => currentControlState(run.id));
    const current = currentPayload.opportunity || currentPayload.data || currentPayload;
    const currentOwner = assignedToOf(current);
    if (currentOwner === detail.newAssignedTo) {
      await detail.update({ estado: "assigned", assignedAt: detail.assignedAt || new Date(), retryable: false, previousAssignedTo: detail.previousAssignedTo || currentOwner, errorCode: null, errorMessage: null });
      return;
    }
    if (!advisorStillActive) {
      await detail.update({ estado: "skipped", retryable: false, errorCode: "ADVISOR_PAUSED", errorMessage: "El asesor dejo de estar en Play antes de la asignacion" });
      return;
    }
    const skipCode = classifyCurrentOpportunity(current, configRow);
    if (skipCode) {
      await detail.update({ estado: "skipped", retryable: false, previousAssignedTo: currentOwner, errorCode: skipCode, errorMessage: skipCode === "STAGE_CHANGED" ? "La oportunidad abandono la etapa antes de asignarla" : "La oportunidad fue asignada manualmente durante la ejecucion" });
      return;
    }
    if (!plannedCapacityAvailable) {
      await detail.update({ estado: "skipped", retryable: false, previousAssignedTo: currentOwner, errorCode: "CAPACITY_REACHED", errorMessage: "La capacidad del asesor cambio antes de completar la asignacion" });
      return;
    }
    await currentControlState(run.id);
    await requestWithRetry(client, { method: "PUT", url: `/opportunities/${encodeURIComponent(detail.opportunityId)}`, data: { assignedTo: detail.newAssignedTo } }, 3, () => currentControlState(run.id));
    try {
      await detail.update({ estado: "assigned", assignedAt: new Date(), retryable: false, previousAssignedTo: currentOwner, errorCode: null, errorMessage: null });
    } catch (storageError) {
      const verificationPayload = await requestWithRetry(client, { method: "GET", url: `/opportunities/${encodeURIComponent(detail.opportunityId)}` }, 3, () => currentControlState(run.id));
      const verification = verificationPayload.opportunity || verificationPayload.data || verificationPayload;
      if (assignedToOf(verification) !== detail.newAssignedTo) throw storageError;
      await detail.update({ estado: "assigned", assignedAt: new Date(), retryable: false, previousAssignedTo: currentOwner, errorCode: null, errorMessage: null });
    }
    if (capacityTracker) capacityTracker.loads.set(detail.newAssignedTo, (Number(capacityTracker.loads.get(detail.newAssignedTo)) || 0) + 1);
  } catch (error) {
    if (error.controlState || error.code === "GHL_EXECUTION_TIMEOUT") throw error;
    const state = await Ejecucion.findByPk(run.id, { attributes: ["estado"] });
    if (["pause_requested", "cancel_requested"].includes(state?.estado)) throw new ExecutionControlSignal(state.estado);
    await detail.update({ estado: "error", retryable: isRetryableError(error), errorCode: error.code || "GHL_UPDATE_ERROR", errorMessage: sanitize(error.message) });
  } finally { await refreshCounters(run); }
}

async function processPlan(run, configRow, client, capacityTracker = null) {
  try {
    throwIfClientAborted(client);
    await currentControlState(run.id);
    const details = await Detalle.findAll({ where: { ejecucionId: run.id, [Op.or]: [{ estado: "pending" }, { estado: "error", retryable: true }] }, order: [["id", "ASC"]] });
    for (const detail of details) {
      throwIfClientAborted(client);
      await currentControlState(run.id);
      await processOneDetail(run, configRow, detail, client, capacityTracker);
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
  const currentGhlUsers = await ghl.fetchAllAssignableUsers(client, config);
  throwIfClientAborted(client);
  const advisors = await advisorsForConfiguration(configRow, currentGhlUsers, runDate);
  throwIfClientAborted(client);
  if (!advisors.active.length) {
    await run.update({
      totalEncontradas: 0,
      totalElegibles: 0,
      totalPlanificadas: 0,
      totalOmitidas: 0,
      totalPendientesCapacidad: 0,
      heartbeatAt: new Date(),
    });
    return { activeUsers: [], nextUserIndex: Number(configRow.indiceSiguienteUsuario) || 0, capacityTracker: null };
  }
  const found = await allStageOpportunities(configRow, client, config, runDate);
  throwIfClientAborted(client);
  const eligible = eligibleOpportunities(found, configRow.modo);
  let assignments = [];
  let nextUserIndex = Number(configRow.indiceSiguienteUsuario) || 0;
  let totalPendientesCapacidad = 0;
  if (advisors.active.length && configRow.modo === "unassigned") {
    const capacityPlan = buildCapacityAssignments(
      eligible,
      advisors.active,
      currentLoadsByAdvisor(found, advisors.active),
      Number(configRow.maxPendientesPorAsesor) || DEFAULT_MAX_PENDING_PER_ADVISOR,
      configRow.indiceSiguienteUsuario,
    );
    assignments = capacityPlan.assignments;
    nextUserIndex = capacityPlan.nextUserIndex;
    totalPendientesCapacidad = capacityPlan.totalPendientesCapacidad;
  } else if (advisors.active.length) {
    assignments = buildAssignments(eligible, advisors.active, configRow.indiceSiguienteUsuario);
  } else if (configRow.modo === "unassigned") {
    totalPendientesCapacidad = eligible.length;
  }
  await run.update({
    totalEncontradas: found.length,
    totalElegibles: eligible.length,
    totalPlanificadas: assignments.length,
    totalOmitidas: found.length - eligible.length,
    totalPendientesCapacidad,
    heartbeatAt: new Date(),
  });
  if (assignments.length) await Detalle.bulkCreate(assignments.map(({ opportunity, user }) => ({ ejecucionId: run.id, opportunityId: idOf(opportunity), previousAssignedTo: assignedToOf(opportunity), newAssignedTo: user.id, estado: "pending", retryable: true })), { ignoreDuplicates: true });
  return {
    activeUsers: advisors.active,
    nextUserIndex,
    capacityTracker: configRow.modo === "unassigned" ? {
      loads: currentLoadsByAdvisor(found, advisors.active),
      limit: Number(configRow.maxPendientesPorAsesor) || DEFAULT_MAX_PENDING_PER_ADVISOR,
    } : null,
  };
}

async function currentCapacityTracker(configRow, client, config, now = new Date()) {
  if (configRow.modo !== "unassigned") return null;
  const currentGhlUsers = await ghl.fetchAllAssignableUsers(client, config);
  throwIfClientAborted(client);
  const advisors = await advisorsForConfiguration(configRow, currentGhlUsers, now);
  throwIfClientAborted(client);
  if (!advisors.active.length) return { loads: new Map(), limit: Number(configRow.maxPendientesPorAsesor) || DEFAULT_MAX_PENDING_PER_ADVISOR };
  const found = await allStageOpportunities(configRow, client, config, now);
  throwIfClientAborted(client);
  return {
    loads: currentLoadsByAdvisor(found, advisors.active),
    limit: Number(configRow.maxPendientesPorAsesor) || DEFAULT_MAX_PENDING_PER_ADVISOR,
  };
}

const lockScopeForConfiguration = (_configRow = null, locationId = null) => distributionLock.advisoryScope(
  locationId || ghl.getGhlConfig({ requirePipelineId: false }).locationId,
);

const isOpenOpportunity = (opportunity) => ghl.getOpportunityStatus(opportunity) === "open";

const configurationMatchesOpportunity = (configRow, opportunity) =>
  configRow.pipelineId === ghl.getOpportunityPipelineId(opportunity)
  && configRow.stageId === ghl.getOpportunityStageId(opportunity);

async function fetchWebhookOpportunity(client, config, { opportunityId, contactId }, context) {
  if (opportunityId) {
    try {
      const payload = await requestWithRetry(client, { method: "GET", url: `/opportunities/${encodeURIComponent(opportunityId)}` });
      return payload.opportunity || payload.data || payload;
    } catch (error) {
      if (error.upstreamStatus === 404 || error.statusCode === 404) return null;
      throw error;
    }
  }
  if (!contactId) return null;
  const candidates = await ghl.fetchOpportunitiesByContact(client, config, contactId);
  const matching = candidates.filter((opportunity) => isRealtimeStageOpportunity(opportunity, context));
  return matching.find((opportunity) => isOpenOpportunity(opportunity) && !assignedToOf(opportunity))
    || matching.find((opportunity) => isOpenOpportunity(opportunity))
    || matching[0]
    || null;
}

function classifyRealtimeOpportunity(opportunity, context) {
  if (!isRealtimeStageOpportunity(opportunity, context)) return "STAGE_NOT_ELIGIBLE";
  if (!isOpenOpportunity(opportunity)) return "OPPORTUNITY_NOT_OPEN";
  if (assignedToOf(opportunity)) return "ALREADY_ASSIGNED";
  return null;
}

async function assignRealtimeOpportunity({
  client,
  context,
  opportunity,
  user,
  loads,
  limit,
  trigger = "webhook",
  onDiagnosticError = null,
}) {
  try {
  throwIfClientAborted(client);
  const activeToday = await awaitReadWithAbort(
    advisorAvailability.isGhlUserActiveToday(user.id),
    client.signal,
  );
  throwIfClientAborted(client);
  if (!activeToday) {
    return { code: "ADVISOR_PAUSED", assigned: false };
  }
  const currentLoad = Number(loads.get(user.id)) || 0;
  if (currentLoad >= limit) {
    return { code: "NO_CAPACITY", assigned: false };
  }
  let payload;
  try {
    payload = await requestWithRetry(client, {
      method: "GET",
      url: `/opportunities/${encodeURIComponent(idOf(opportunity))}`,
    });
  } catch (error) {
    if (error.upstreamStatus === 404 || error.statusCode === 404) {
      return { code: "OPPORTUNITY_NOT_FOUND", assigned: false };
    }
    throw error;
  }
  const current = payload.opportunity || payload.data || payload;
  throwIfClientAborted(client);
  const skipCode = classifyRealtimeOpportunity(current, context);
  if (skipCode) {
    return { code: skipCode, assigned: false };
  }
  throwIfClientAborted(client);
  await requestWithRetry(client, {
    method: "PUT",
    url: `/opportunities/${encodeURIComponent(idOf(current))}`,
    data: { assignedTo: user.id },
  });
  const assignedAt = new Date();
  let tracePersisted = true;
  try {
    await awaitReadWithAbort(TiempoRealAsignacion.create({
      opportunityId: idOf(current),
      ghlUserId: user.id,
      pipelineId: context.pipelineId,
      stageId: ghl.getOpportunityStageId(current),
      trigger: String(trigger || "realtime").replace(/[^a-z0-9_-]/gi, "").slice(0, 30) || "realtime",
      assignedAt,
    }), client.signal);
  } catch (error) {
    tracePersisted = false;
    if (typeof onDiagnosticError === "function") {
      onDiagnosticError(error, "GHL_REALTIME_TRACE_ERROR");
    }
  }
  loads.set(user.id, (Number(loads.get(user.id)) || 0) + 1);
  return {
    code: "ASSIGNED",
    assigned: true,
    opportunityId: idOf(current),
    advisorId: user.id,
    assignedAt,
    tracePersisted,
  };
  } catch (error) {
    throw error;
  }
}

async function executeWebhookOpportunity({ opportunityId = null, contactId = null, locationId = null } = {}) {
  const config = ghl.getGhlConfig({ requirePipelineId: false });
  if (locationId && String(locationId) !== String(config.locationId)) {
    return { code: "LOCATION_MISMATCH", assigned: false, deferredToScheduler: false };
  }
  const retryState = await realtimeReviewCoordinator.getRetryState(config.locationId);
  if (retryState.suspended) {
    return {
      code: "GHL_REPARTO_SUSPENDED",
      assigned: false,
      deferredToScheduler: true,
      retryAfter: retryState.retryAfter,
    };
  }
  const lock = await distributionLock.acquire(config.locationId);
  if (!lock) {
    return { code: "PREVIOUS_EXECUTION_RUNNING", assigned: false, deferredToScheduler: true, repartoOmitido: true };
  }
  try {
    const result = await distributionLock.runWithTimeout(lock, async () => {
    const { client } = await getClient(lock.controller.signal, config);
    const currentGhlUsers = await ghl.fetchAllAssignableUsers(client, config);
    const advisors = await awaitReadWithAbort(
      advisorAvailability.resolveActiveAdvisors(currentGhlUsers, new Date()),
      lock.controller.signal,
    );
    distributionLock.throwIfAborted(lock);
    if (!advisors.active.length) {
      return { code: "NO_ACTIVE_ADVISORS", assigned: false, deferredToScheduler: true };
    }
    const context = await getRealtimePipelineContext(client, config);
    const opportunity = await fetchWebhookOpportunity(
      client,
      config,
      { opportunityId, contactId },
      context,
    );
    if (!opportunity || !idOf(opportunity)) {
      return { code: "OPPORTUNITY_NOT_FOUND", assigned: false, deferredToScheduler: true };
    }
    const initialSkipCode = classifyRealtimeOpportunity(opportunity, context);
    if (initialSkipCode) {
      return { code: initialSkipCode, assigned: false, deferredToScheduler: false };
    }
    const found = await fetchRealtimeOpenOpportunities(client, config, context);
    distributionLock.throwIfAborted(lock);
    const limit = realtimeMaxPendingPerAdvisor();
    const loads = currentLoadsByAdvisor(found, advisors.active);
    const capacityPlan = buildCapacityAssignments(
      [opportunity],
      advisors.active,
      loads,
      limit,
      realtimeNextUserIndex,
    );
    if (!capacityPlan.assignments.length) {
      return { code: "NO_CAPACITY", assigned: false, deferredToScheduler: true };
    }
    const result = await assignRealtimeOpportunity({
      client,
      context,
      opportunity,
      user: capacityPlan.assignments[0].user,
      loads,
      limit,
      trigger: "webhook",
    });
    if (result.assigned) realtimeNextUserIndex = capacityPlan.nextUserIndex;
    return {
      ...result,
      deferredToScheduler: ["ADVISOR_PAUSED", "NO_CAPACITY", "OPPORTUNITY_NOT_FOUND"].includes(result.code),
    };
    }, undefined, {
      onUnresponsive: (error) => realtimeReviewCoordinator.recordFailure(
        config.locationId,
        error.code,
      ),
    });
    await realtimeReviewCoordinator.clearFailures(config.locationId);
    return result;
  } catch (error) {
    if (error.code !== "GHL_CANCELLATION_UNRESPONSIVE") {
      await realtimeReviewCoordinator.recordFailure(
        config.locationId,
        error.code || "GHL_WEBHOOK_REPARTO_ERROR",
      ).catch(() => {});
    }
    throw error;
  } finally {
    await distributionLock.release(lock);
  }
}

async function executeRealtimeQueue({ trigger = "scheduler", quietIfBusy = false } = {}) {
  const startedAt = Date.now();
  let phase = "ADVISORY_LOCK";
  let phaseStartedAt = startedAt;
  let phaseClosed = false;
  let lock = null;
  let queueResult = null;
  let finalError = null;
  let finalFailurePhase = null;
  let firstError = null;
  let omitted = false;
  let config = null;
  let backoffRecorded = false;
  const summary = {
    fechaHora: null,
    origen: trigger,
    duracionMs: null,
    enColaAlInicio: null,
    asesoresActivos: null,
    asesoresPausados: null,
    asociacionesInvalidas: null,
    capacidadDisponibleTotal: null,
    asignacionesPlanificadas: null,
    asignacionesExitosas: null,
    pendientesEstimados: null,
    omitidasPorMotivo: null,
    erroresPorCodigo: null,
    mensajesErrorPorCodigo: null,
    paginasConsultadas: 0,
    oportunidadesExaminadas: 0,
    duracionesPorFaseMs: {},
    resultado: null,
  };
  const progress = {
    pagesConsulted: 0,
    opportunitiesExamined: 0,
    assignmentsCompleted: 0,
  };
  const closeCurrentPhase = () => {
    if (phaseClosed) return;
    summary.duracionesPorFaseMs[phase] = (summary.duracionesPorFaseMs[phase] || 0)
      + Math.max(0, Date.now() - phaseStartedAt);
    phaseClosed = true;
  };
  const setPhase = (nextPhase) => {
    closeCurrentPhase();
    phase = nextPhase;
    phaseStartedAt = Date.now();
    phaseClosed = false;
    distributionLock.updateProgress(lock, { phase, ...progress });
  };
  const recordPage = ({ examined = 0 } = {}) => {
    progress.pagesConsulted += 1;
    progress.opportunitiesExamined += Number(examined) || 0;
    summary.paginasConsultadas = progress.pagesConsulted;
    summary.oportunidadesExaminadas = progress.opportunitiesExamined;
    distributionLock.updateProgress(lock, { phase, ...progress });
  };
  const countByCode = (field, code, amount = 1) => {
    if (amount <= 0) return;
    if (!summary[field]) summary[field] = {};
    summary[field][code] = (summary[field][code] || 0) + amount;
  };
  const recordError = (error, failurePhase, fallbackCode = "GHL_REALTIME_QUEUE_ERROR") => {
    const code = error.code || fallbackCode;
    countByCode("erroresPorCodigo", code);
    if (!summary.mensajesErrorPorCodigo) summary.mensajesErrorPorCodigo = {};
    if (!summary.mensajesErrorPorCodigo[code]) {
      summary.mensajesErrorPorCodigo[code] = sanitize(error.message);
    }
    if (!firstError) firstError = {
      error: error.code ? error : Object.assign(new Error(error.message), { ...error, code }),
      phase: failurePhase,
    };
  };
  const emitSummary = () => {
    closeCurrentPhase();
    const failure = finalError
      ? { error: finalError, phase: finalFailurePhase || phase }
      : (["QUEUE_FAILED", "QUEUE_PARTIAL"].includes(queueResult?.code) ? firstError : null);
    console.log("[GHL] RESUMEN_REPARTO", {
      ...summary,
      fechaHora: new Date().toISOString(),
      duracionMs: Math.max(0, Date.now() - startedAt),
      resultado: finalError ? "FAILED" : queueResult?.code || "GHL_REALTIME_QUEUE_ERROR",
      ...(failure ? {
        faseDelFallo: failure.phase,
        codigo: failure.error.code || "GHL_REALTIME_QUEUE_ERROR",
        estadoHttp: failure.error.response?.status
          ?? failure.error.upstreamStatus
          ?? failure.error.statusCode
          ?? null,
        mensaje: sanitize(failure.error.message),
      } : {}),
    });
  };
  const recordPersistentFailure = async (code) => {
    if (!config?.locationId || backoffRecorded) return;
    try {
      await realtimeReviewCoordinator.recordFailure(config.locationId, code);
      backoffRecorded = true;
    } catch (error) {
      console.error("[GHL] REPARTO_BACKOFF_NO_PERSISTIDO", {
        codigo: error.code || "GHL_REPARTO_BACKOFF_ERROR",
      });
    }
  };
  const clearPersistentFailures = async () => {
    if (!config?.locationId) return;
    try {
      await realtimeReviewCoordinator.clearFailures(config.locationId);
    } catch (error) {
      console.error("[GHL] REPARTO_BACKOFF_NO_LIMPIADO", {
        codigo: error.code || "GHL_REPARTO_BACKOFF_ERROR",
      });
    }
  };

  try {
    config = ghl.getGhlConfig({ requirePipelineId: false });
    const retryState = await realtimeReviewCoordinator.getRetryState(config.locationId);
    if (retryState.suspended) {
      queueResult = {
        code: "GHL_REPARTO_SUSPENDED",
        assigned: false,
        assignedCount: 0,
        trigger,
        retryAfter: retryState.retryAfter,
        lastFailureCode: retryState.lastFailureCode,
      };
      return queueResult;
    }
    lock = await distributionLock.acquire(config.locationId, {
      logIfUnavailable: !quietIfBusy,
    });
    if (!lock) {
      omitted = true;
      queueResult = { code: "PREVIOUS_EXECUTION_RUNNING", assigned: false, assignedCount: 0, trigger, repartoOmitido: true };
      return queueResult;
    }
    distributionLock.updateProgress(lock, { phase, ...progress });
    const executionResult = await distributionLock.runWithTimeout(lock, async () => {
    summary.omitidasPorMotivo = {};
    summary.erroresPorCodigo = {};
    summary.mensajesErrorPorCodigo = {};
    setPhase("GHL_CLIENT");
    const { client } = await getClient(lock.controller.signal, config);
    setPhase("ADVISOR_CATALOG");
    const currentGhlUsers = await ghl.fetchAllAssignableUsers(client, config);
    setPhase("ADVISOR_RESOLUTION");
    const advisors = await awaitReadWithAbort(
      advisorAvailability.resolveActiveAdvisors(currentGhlUsers, new Date()),
      lock.controller.signal,
    );
    distributionLock.throwIfAborted(lock);
    summary.asesoresActivos = advisors.active.length;
    summary.asesoresPausados = advisors.paused.length;
    summary.asociacionesInvalidas = advisors.invalid.length;
    if (!advisors.active.length) {
      summary.capacidadDisponibleTotal = 0;
      summary.asignacionesPlanificadas = 0;
      summary.asignacionesExitosas = 0;
      summary.pendientesEstimados = null;
      queueResult = { code: "NO_ACTIVE_ADVISORS", assigned: false, assignedCount: 0, pendingCount: null, trigger };
      return queueResult;
    }
    setPhase("PIPELINE_CONTEXT");
    const context = await getRealtimePipelineContext(client, config);
    setPhase("QUEUE_DATA");
    const found = await fetchRealtimeOpenOpportunities(
      client,
      config,
      context,
      { onPage: recordPage },
    );
    distributionLock.throwIfAborted(lock);
    const pending = eligibleOpportunities(found, "unassigned");
    summary.enColaAlInicio = pending.length;
    if (!pending.length) {
      summary.asignacionesPlanificadas = 0;
      summary.asignacionesExitosas = 0;
      summary.pendientesEstimados = 0;
      queueResult = { code: "NO_PENDING_OPPORTUNITIES", assigned: false, assignedCount: 0, pendingCount: 0, trigger };
      return queueResult;
    }
    setPhase("CAPACITY_PLANNING");
    const limit = realtimeMaxPendingPerAdvisor();
    const loads = currentLoadsByAdvisor(found, advisors.active);
    const capacityPlan = buildCapacityAssignments(
      pending,
      advisors.active,
      loads,
      limit,
      realtimeNextUserIndex,
    );
    summary.capacidadDisponibleTotal = capacityPlan.advisors.reduce(
      (total, advisor) => total + Number(advisor.capacidadDisponible || 0),
      0,
    );
    summary.asignacionesPlanificadas = capacityPlan.assignments.length;
    const withoutCapacity = Math.max(0, pending.length - capacityPlan.assignments.length);
    if (withoutCapacity > 0) countByCode("omitidasPorMotivo", "NO_CAPACITY", withoutCapacity);
    if (!capacityPlan.assignments.length) {
      summary.asignacionesExitosas = 0;
      summary.pendientesEstimados = pending.length;
      queueResult = { code: "NO_CAPACITY", assigned: false, assignedCount: 0, pendingCount: pending.length, trigger };
      return queueResult;
    }
    let assignedCount = 0;
    let errorCount = 0;
    setPhase("ASSIGNMENTS");
    for (const assignment of capacityPlan.assignments) {
      distributionLock.throwIfAborted(lock);
      try {
        const result = await assignRealtimeOpportunity({
          client,
          context,
          opportunity: assignment.opportunity,
          user: assignment.user,
          loads,
          limit,
          trigger,
          onDiagnosticError: (error, fallbackCode) => recordError(error, "TRACE_PERSISTENCE", fallbackCode),
        });
        if (result.assigned) {
          assignedCount += 1;
          progress.assignmentsCompleted = assignedCount;
          distributionLock.updateProgress(lock, { phase, ...progress });
        }
        else countByCode("omitidasPorMotivo", result.code || "ASSIGNMENT_SKIPPED");
      } catch (error) {
        distributionLock.throwIfAborted(lock);
        errorCount += 1;
        recordError(error, "ASSIGNMENT");
      }
    }
    realtimeNextUserIndex = capacityPlan.nextUserIndex;
    queueResult = {
      code: errorCount ? (assignedCount ? "QUEUE_PARTIAL" : "QUEUE_FAILED") : "QUEUE_PROCESSED",
      assigned: assignedCount > 0,
      assignedCount,
      errorCount,
      pendingCount: Math.max(0, pending.length - assignedCount),
      trigger,
    };
    summary.asignacionesExitosas = assignedCount;
    summary.pendientesEstimados = queueResult.pendingCount;
    return queueResult;
    }, undefined, {
      onUnresponsive: (error) => recordPersistentFailure(error.code),
    });
    if (["QUEUE_FAILED", "QUEUE_PARTIAL"].includes(executionResult?.code)) {
      await recordPersistentFailure(firstError?.error?.code || executionResult.code);
    } else {
      await clearPersistentFailures();
    }
    return executionResult;
  } catch (error) {
    finalError = error;
    finalFailurePhase = phase;
    recordError(error, phase);
    await recordPersistentFailure(error.code || "GHL_REALTIME_QUEUE_ERROR");
    throw error;
  } finally {
    if (lock) {
      try {
        setPhase("LOCK_RELEASE");
        await distributionLock.release(lock);
      } catch (error) {
        finalError = error;
        finalFailurePhase = phase;
        recordError(error, phase);
        throw error;
      } finally {
        emitSummary();
      }
    } else if (!omitted) {
      emitSummary();
    }
  }
}

async function scheduleRealtimeQueueReview({ trigger = "play" } = {}) {
  const config = ghl.getGhlConfig({ requirePipelineId: false });
  return realtimeReviewCoordinator.requestReview({
    locationId: config.locationId,
    trigger,
    executeQueue: executeRealtimeQueue,
  });
}

async function recoverPendingRealtimeQueueReviews() {
  return realtimeReviewCoordinator.recoverPendingReviews({
    executeQueue: executeRealtimeQueue,
  });
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
  const config = ghl.getGhlConfig({ requirePipelineId: false });
  const retryState = await realtimeReviewCoordinator.getRetryState(config.locationId);
  if (retryState.suspended) {
    return {
      skipped: true,
      code: "GHL_REPARTO_SUSPENDED",
      retryAfter: retryState.retryAfter,
    };
  }
  const lock = await distributionLock.acquire(config.locationId);
  if (!lock) return { skipped: true, reason: "Ya existe una ejecucion activa", code: "PREVIOUS_EXECUTION_RUNNING", repartoOmitido: true };
  let run;
  try {
    const executionResult = await distributionLock.runWithTimeout(lock, async () => {
    await interruptStaleForConfig(configRow.id);
    distributionLock.throwIfAborted(lock);
    const blocking = await blockingExecution(configRow.id);
    if (blocking) return { skipped: true, reason: blocking.estado === "paused" ? "Existe una ejecucion pausada; reanudela o cancelela antes de iniciar otra" : "Ya existe una ejecucion activa", code: "EXECUTION_ALREADY_ACTIVE" };
    try {
      run = await Ejecucion.create({ configuracionId: configRow.id, tipo: type, scheduledFor, ventanaProgramada: window, startedAt: new Date(), heartbeatAt: new Date(), estado: "running", pipelineNombre: configRow.pipelineNombre, stageNombre: configRow.stageNombre, ejecutadoPorId: userId });
    } catch (error) {
      if (error.name === "SequelizeUniqueConstraintError") return { skipped: true, reason: "Esta ventana programada ya fue procesada o existe una ejecucion activa", code: "EXECUTION_ALREADY_ACTIVE" };
      throw error;
    }
    activeAbortControllers.set(String(run.id), lock.controller);
    const { client } = await getClient(lock.controller.signal, config);
    const plan = await createPlan(run, configRow, client, config, scheduledFor || new Date());
    distributionLock.throwIfAborted(lock);
    if (!plan.activeUsers.length) {
      await run.update({
        estado: "skipped",
        finishedAt: new Date(),
        heartbeatAt: new Date(),
        errorGeneral: "Sin asesores en Play; las oportunidades quedaron pendientes sin propietario",
      });
      return run.reload();
    }
    await currentControlState(run.id);
    const result = await processPlan(run, configRow, client, plan.capacityTracker);
    if (["completed", "partial"].includes(result.estado)) {
      const nextUserIndex = configRow.modo === "unassigned"
        ? plan.nextUserIndex
        : (configRow.indiceSiguienteUsuario + (Number(result.totalAsignadas || 0) % plan.activeUsers.length)) % plan.activeUsers.length;
      await configRow.update({ indiceSiguienteUsuario: nextUserIndex });
    }
    return result;
    }, undefined, {
      onUnresponsive: (error) => realtimeReviewCoordinator.recordFailure(
        config.locationId,
        error.code,
      ),
    });
    await realtimeReviewCoordinator.clearFailures(config.locationId);
    return executionResult;
  } catch (error) {
    if (error.code !== "GHL_CANCELLATION_UNRESPONSIVE") {
      await realtimeReviewCoordinator.recordFailure(
        config.locationId,
        error.code || "GHL_SCHEDULED_REPARTO_ERROR",
      ).catch(() => {});
    }
    if (run) {
      const fresh = await Ejecucion.findByPk(run.id).catch(() => null);
      if (["pause_requested", "cancel_requested"].includes(fresh?.estado)) { await finalizeControl(fresh, fresh.estado); return fresh.reload(); }
      const counters = await refreshCounters(run).catch(() => ({ assigned: Number(run.totalAsignadas || 0) }));
      await run.update({ finishedAt: new Date(), estado: counters.assigned ? "partial" : "failed", heartbeatAt: new Date(), errorGeneral: sanitize(error.message) }).catch(() => {});
    }
    throw error;
  } finally {
    if (run) activeAbortControllers.delete(String(run.id));
    await distributionLock.release(lock);
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
  const lockScope = lockScopeForConfiguration();
  const lock = await acquireLock(lockScope);
  if (!lock) throw serviceError("EXECUTION_ALREADY_ACTIVE", "La ejecucion esta siendo procesada; intente nuevamente");
  try {
    const run = await transitionLocked(id, async (run, transaction) => {
      if (run.estado !== "paused") throw serviceError("EXECUTION_NOT_CANCELLABLE", "La ejecucion cambio de estado");
      await run.update({ estado: "cancel_requested", cancelRequestedAt: new Date() }, { transaction });
      return run;
    });
    await finalizeControl(run, "cancel_requested");
    return run.reload();
  } finally { await releaseLock(lock, lockScope); }
}

async function resume(id) {
  const initial = await Ejecucion.findByPk(id);
  if (!initial) throw serviceError("EXECUTION_NOT_FOUND", "Ejecucion no encontrada", 404);
  if (TERMINAL_STATES.includes(initial.estado)) throw serviceError("EXECUTION_ALREADY_FINISHED", "La ejecucion ya finalizo");
  if (initial.estado !== "paused") throw serviceError("EXECUTION_NOT_RESUMABLE", "Solo una ejecucion pausada puede reanudarse");
  const configRow = await Configuracion.findByPk(initial.configuracionId);
  if (!configRow) throw serviceError("CONFIGURATION_NOT_FOUND", "La configuracion de esta ejecucion ya no existe", 404);
  const config = ghl.getGhlConfig({ requirePipelineId: false });
  const retryState = await realtimeReviewCoordinator.getRetryState(config.locationId);
  if (retryState.suspended) {
    throw serviceError(
      "GHL_REPARTO_SUSPENDED",
      `El reparto GHL esta suspendido temporalmente hasta ${retryState.retryAfter}`,
      503,
    );
  }
  const lock = await distributionLock.acquire(config.locationId);
  if (!lock) throw serviceError("EXECUTION_ALREADY_ACTIVE", "Existe otro proceso activo para esta configuracion");
  try {
    const result = await distributionLock.runWithTimeout(lock, async () => {
    const run = await transitionLocked(id, async (current, transaction) => {
      if (current.estado !== "paused") throw serviceError("EXECUTION_NOT_RESUMABLE", "La ejecucion ya no esta pausada");
      if (await blockingExecution(current.configuracionId, current.id, transaction)) throw serviceError("EXECUTION_ALREADY_ACTIVE", "Existe otra ejecucion activa para esta configuracion");
      await current.update({ estado: "running", resumedAt: new Date(), pausedAt: null, heartbeatAt: new Date() }, { transaction });
      return current;
    });
    activeAbortControllers.set(String(run.id), lock.controller);
    const { client } = await getClient(lock.controller.signal, config);
    const capacityTracker = await currentCapacityTracker(configRow, client, config);
    return await processPlan(run, configRow, client, capacityTracker);
    }, undefined, {
      onUnresponsive: (error) => realtimeReviewCoordinator.recordFailure(
        config.locationId,
        error.code,
      ),
    });
    await realtimeReviewCoordinator.clearFailures(config.locationId);
    return result;
  } catch (error) {
    if (error.code !== "GHL_CANCELLATION_UNRESPONSIVE") {
      await realtimeReviewCoordinator.recordFailure(
        config.locationId,
        error.code || "GHL_RESUME_REPARTO_ERROR",
      ).catch(() => {});
    }
    const run = await Ejecucion.findByPk(id).catch(() => null);
    if (run?.estado === "running") {
      const counters = await refreshCounters(run).catch(() => ({ assigned: Number(run.totalAsignadas || 0) }));
      await run.update({ estado: counters.assigned ? "partial" : "failed", finishedAt: new Date(), errorGeneral: sanitize(error.message), heartbeatAt: new Date() }).catch(() => {});
    }
    throw error;
  } finally {
    activeAbortControllers.delete(String(id));
    await distributionLock.release(lock);
  }
}

async function isExecutionStale(run) {
  if (!heartbeatExpired(run)) return false;
  const lockScope = lockScopeForConfiguration();
  const lock = await acquireLock(lockScope);
  if (!lock) return false;
  await releaseLock(lock, lockScope);
  return true;
}

async function forceFinishStale(id) {
  const initial = await Ejecucion.findByPk(id);
  if (!initial) throw serviceError("EXECUTION_NOT_FOUND", "Ejecucion no encontrada", 404);
  if (TERMINAL_STATES.includes(initial.estado) || initial.estado === "paused") throw serviceError("EXECUTION_ALREADY_FINISHED", "La ejecucion no esta activa");
  if (!heartbeatExpired(initial)) throw serviceError("EXECUTION_NOT_STALE", "La ejecucion mantiene un heartbeat saludable");
  const lockScope = lockScopeForConfiguration();
  const lock = await acquireLock(lockScope);
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
  } finally { await releaseLock(lock, lockScope); }
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
  const configWhere = query.tipo === "refresco"
    ? { modo: "refresh_non_management" }
    : query.tipo === "reparto"
      ? { modo: { [Op.in]: ["unassigned", "all"] } }
      : undefined;
  const rows = await Ejecucion.findAll({ where, include: [
    { model: Usuario, as: "ejecutadoPor", attributes: ["id", "nombre", "email"] },
    { association: "configuracion", attributes: ["id", "modo"], ...(configWhere ? { where: configWhere, required: true } : {}) },
  ], order: [["startedAt", "DESC"]], limit: Math.min(Number(query.limit) || 50, 100) });
  return Promise.all(rows.map(async (run) => ({ ...run.toJSON(), isStale: await isExecutionStale(run) })));
}

module.exports = {
  TIME_ZONE, DEFAULT_MAX_PENDING_PER_ADVISOR, MAX_PENDING_PER_ADVISOR, REALTIME_LOCK_SCOPE, ACTIVE_STATES, BLOCKING_STATES, TERMINAL_STATES, STALE_AFTER_MS,
  uniqueUsers, buildAssignments, currentLoadsByAdvisor, buildCapacityAssignments, eligibleOpportunities, classifyCurrentOpportunity,
  executionState, localScheduleParts, opportunityDateRange, opportunityTodayRange, heartbeatExpired, sanitize,
  getCatalogs, pipelineStages, normalizeStageName, realtimeStageChannel, realtimeMaxPendingPerAdvisor,
  getRealtimePipelineContext, isRealtimeStageOpportunity, fetchRealtimeOpenOpportunities,
  validateInput, allStageOpportunities, advisorsForConfiguration, preview, requestWithRetry, acquireLock,
  releaseLock, lockScopeForConfiguration, refreshCounters, processOneDetail, processPlan, execute, requestPause,
  requestCancel, resume, isExecutionStale, forceFinishStale, listExecutions, recoverStaleRuns,
  isOpenOpportunity, configurationMatchesOpportunity, fetchWebhookOpportunity, classifyRealtimeOpportunity,
  assignRealtimeOpportunity, executeWebhookOpportunity, executeRealtimeQueue, scheduleRealtimeQueueReview,
  recoverPendingRealtimeQueueReviews,
};
