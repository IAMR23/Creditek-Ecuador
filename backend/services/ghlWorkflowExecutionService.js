const { Op } = require("sequelize");
const Programacion = require("../models/GhlWorkflowProgramacion");
const Ejecucion = require("../models/GhlWorkflowEjecucion");
const Detalle = require("../models/GhlWorkflowEjecucionDetalle");
const ghl = require("./ghlService");
const configurationService = require("./ghlWorkflowConfigurationService");
const executionLock = require("./ghlWorkflowExecutionLock");

const STALE_AFTER_MS = Math.max(60_000, Number(process.env.GHL_WORKFLOW_STALE_MS) || 300_000);
const CONCURRENCY = Math.min(10, Math.max(1, Number(process.env.GHL_WORKFLOW_CONCURRENCY) || 3));
const idOf = (value) => ghl.toId(value?.id || value?._id || value);

async function mapWithConcurrency(items, limit, mapper) {
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      await mapper(items[index], index);
    }
  });
  await Promise.all(workers);
}

function isEligibleOpportunity(opportunity, programacion) {
  return ghl.getOpportunityStatus(opportunity) === "open"
    && ghl.getOpportunityPipelineId(opportunity) === programacion.pipelineId
    && programacion.stageIds.includes(ghl.getOpportunityStageId(opportunity))
    && Boolean(ghl.getOpportunityContactId(opportunity));
}

async function collectEligible(programacion, { onPage } = {}) {
  const config = {
    ...ghl.getGhlConfig({ requirePipelineId: false }),
    pipelineId: programacion.pipelineId,
  };
  const client = ghl.createGhlClient(config);
  const opportunities = [];
  let pages = 0;
  for (const pipelineStageId of programacion.stageIds) {
    const stageRows = await ghl.fetchOpportunitiesByStatus(
      client,
      { ...config, pipelineStageId },
      "open",
      {},
      { onPage: (page) => { pages += 1; onPage?.(page); } },
    );
    opportunities.push(...stageRows);
  }
  const seenOpportunities = new Set();
  const valid = opportunities.filter((opportunity) => {
    const opportunityId = idOf(opportunity);
    if (!isEligibleOpportunity(opportunity, programacion)) return false;
    if (opportunityId && seenOpportunities.has(opportunityId)) return false;
    if (opportunityId) seenOpportunities.add(opportunityId);
    return true;
  });
  const byContact = new Map();
  valid.forEach((opportunity) => {
    const contactId = ghl.getOpportunityContactId(opportunity);
    if (!byContact.has(contactId)) byContact.set(contactId, []);
    byContact.get(contactId).push(opportunity);
  });
  return {
    client,
    config,
    opportunities,
    valid,
    byContact,
    pages,
  };
}

async function preview(programacion) {
  const validated = await configurationService.validateInput(
    typeof programacion.toJSON === "function" ? programacion.toJSON() : programacion,
  );
  const result = await collectEligible(validated);
  return {
    totalEncontrado: result.opportunities.length,
    totalElegible: result.valid.length,
    totalDeduplicado: result.byContact.size,
    paginasConsultadas: result.pages,
    inscripcionesRealizadas: 0,
    message: result.byContact.size
      ? "Vista previa completada. No se inscribio ningun contacto."
      : "No hay oportunidades elegibles en este momento.",
  };
}

async function markDetail(detail, estado, values = {}) {
  await detail.update({
    estado,
    processedAt: new Date(),
    errorCode: values.errorCode || null,
    mensaje: values.mensaje ? configurationService.sanitize(values.mensaje) : null,
    ...(values.opportunityId ? { opportunityId: values.opportunityId } : {}),
  });
}

async function revalidateContact(client, programacion, candidates = []) {
  const seen = new Set();
  for (const candidate of candidates) {
    const opportunityId = idOf(candidate);
    if (!opportunityId || seen.has(opportunityId)) continue;
    seen.add(opportunityId);
    const opportunity = await ghl.fetchOpportunityById(client, opportunityId);
    if (opportunity && isEligibleOpportunity(opportunity, programacion)) return opportunity;
  }
  return null;
}

async function hasPriorSuccess(programacion, detail, execution) {
  if (programacion.permitirReingreso) {
    return Detalle.findOne({
      where: {
        contactId: detail.contactId,
        workflowId: detail.workflowId,
        fechaLocal: execution.fechaLocal,
        estado: "success",
        id: { [Op.ne]: detail.id },
      },
    });
  }
  return Detalle.findOne({
    where: {
      configuracionId: programacion.id,
      contactId: detail.contactId,
      workflowId: detail.workflowId,
      estado: "success",
      id: { [Op.ne]: detail.id },
    },
  });
}

async function processDetail(detail, execution, shared) {
  const initialProgramacion = await Programacion.findByPk(execution.configuracionId);
  const initialDetail = await Detalle.findByPk(detail.id);
  if (!initialDetail || ["processing", "success", "skipped", "failed_final"].includes(initialDetail.estado)) return;
  const enrollmentScope = initialProgramacion?.permitirReingreso
    ? `contact-day:${initialDetail.contactId}:${initialDetail.workflowId}:${execution.fechaLocal}`
    : `contact-config:${execution.configuracionId}:${initialDetail.contactId}:${initialDetail.workflowId}`;
  const contactLock = await executionLock.acquire(enrollmentScope);
  if (!contactLock) {
    await markDetail(initialDetail, "skipped", {
      errorCode: "ENROLLMENT_IN_PROGRESS",
      mensaje: "Otra instancia ya procesa esta inscripcion",
    });
    return;
  }
  try {
    const [currentExecution, programacion, current] = await Promise.all([
      Ejecucion.findByPk(execution.id),
      Programacion.findByPk(execution.configuracionId),
      Detalle.findByPk(detail.id),
    ]);
    if (!current || ["processing", "success", "skipped", "failed_final"].includes(current.estado)) return;
    if (currentExecution?.estado !== "running") {
      await markDetail(current, "skipped", {
        errorCode: "EXECUTION_NOT_ACTIVE",
        mensaje: "La ejecucion ya no se encuentra activa",
      });
      return;
    }
    if (!programacion?.activo) {
      await markDetail(current, "skipped", {
        errorCode: "CONFIGURATION_PAUSED",
        mensaje: "La programacion fue pausada antes de procesar el contacto",
      });
      return;
    }
    if (await hasPriorSuccess(programacion, current, execution)) {
      await markDetail(current, "skipped", {
        errorCode: programacion.permitirReingreso ? "ALREADY_ENROLLED_TODAY" : "REENTRY_DISABLED",
        mensaje: programacion.permitirReingreso
          ? "El contacto ya fue inscrito hoy en este workflow"
          : "El contacto ya fue inscrito por esta programacion y el reingreso esta desactivado",
      });
      return;
    }

    const opportunity = await revalidateContact(
      shared.client,
      programacion,
      shared.byContact.get(current.contactId) || [],
    );
    if (!opportunity) {
      await markDetail(current, "skipped", {
        errorCode: "OPPORTUNITY_NO_LONGER_ELIGIBLE",
        mensaje: "La oportunidad dejo de estar abierta en el pipeline o etapas seleccionadas",
      });
      return;
    }

    try {
      await ghl.validateWorkflow(shared.client, shared.config, programacion.workflowId);
    } catch (error) {
      if (["GHL_WORKFLOW_NOT_FOUND", "GHL_WORKFLOW_INACTIVE"].includes(error.code)) {
        await markDetail(current, "skipped", { errorCode: error.code, mensaje: error.message });
        return;
      }
      throw error;
    }

    await current.update({
      estado: "processing",
      intentos: current.intentos + 1,
      opportunityId: idOf(opportunity),
      processedAt: null,
      errorCode: null,
      mensaje: null,
    });
    await ghl.enrollContactInWorkflow(
      shared.client,
      shared.config,
      current.contactId,
      current.workflowId,
      { beforeRetry: () => execution.update({ heartbeatAt: new Date() }) },
    );
    await markDetail(current, "success", { opportunityId: idOf(opportunity) });
  } finally {
    await executionLock.release(contactLock);
  }
}

async function refreshCounters(execution) {
  const details = await Detalle.findAll({ where: { ejecucionId: execution.id }, attributes: ["estado"] });
  const counters = details.reduce((acc, detail) => {
    if (detail.estado === "success") acc.totalProcesado += 1;
    else if (detail.estado === "skipped") acc.totalOmitido += 1;
    else if (detail.estado === "processing" || detail.estado.startsWith("failed")) acc.totalFallido += 1;
    return acc;
  }, { totalProcesado: 0, totalOmitido: 0, totalFallido: 0 });
  await execution.update(counters);
  return counters;
}

async function execute(programacion, execution) {
  const lock = await executionLock.acquire(`configuration:${programacion.id}`);
  if (!lock) return { skipped: true, code: "EXECUTION_IN_PROGRESS", execution };
  const started = Date.now();
  try {
    await execution.reload();
    if (["completed", "partial", "failed", "cancelled"].includes(execution.estado)) {
      return { skipped: true, code: "WINDOW_ALREADY_PROCESSED", execution };
    }
    await Detalle.update({
      estado: "failed_final",
      processedAt: new Date(),
      errorCode: "AMBIGUOUS_ENROLLMENT_RESULT",
      mensaje: "No se repitio una inscripcion cuyo resultado pudo quedar confirmado en HighLevel",
    }, { where: { ejecucionId: execution.id, estado: "processing" } });
    await execution.update({ estado: "running", startedAt: execution.startedAt || new Date(), heartbeatAt: new Date() });
    const freshProgramacion = await Programacion.findByPk(programacion.id);
    if (!freshProgramacion?.activo) {
      await execution.update({ estado: "cancelled", finishedAt: new Date(), codigoGeneral: "CONFIGURATION_PAUSED" });
      return { skipped: true, code: "CONFIGURATION_PAUSED", execution };
    }
    const validated = await configurationService.validateInput(freshProgramacion.toJSON(), { requireActive: true });
    const currentProgramacion = { ...freshProgramacion.toJSON(), ...validated };
    const shared = await collectEligible(currentProgramacion, {
      onPage: () => execution.update({ heartbeatAt: new Date() }).catch(() => {}),
    });
    await execution.update({
      totalEncontrado: shared.opportunities.length,
      totalElegible: shared.valid.length,
      totalDeduplicado: shared.byContact.size,
      paginasConsultadas: shared.pages,
      heartbeatAt: new Date(),
    });
    const rows = [...shared.byContact.entries()].map(([contactId, opportunities]) => ({
      ejecucionId: execution.id,
      configuracionId: currentProgramacion.id,
      contactId,
      opportunityId: idOf(opportunities[0]),
      workflowId: currentProgramacion.workflowId,
      fechaLocal: execution.fechaLocal,
      estado: "pending",
    }));
    if (rows.length) await Detalle.bulkCreate(rows, { ignoreDuplicates: true });
    const details = await Detalle.findAll({
      where: { ejecucionId: execution.id, estado: { [Op.in]: ["pending", "failed_retryable"] } },
      order: [["id", "ASC"]],
    });
    await mapWithConcurrency(details, CONCURRENCY, async (detail) => {
      try {
        await processDetail(detail, execution, shared);
      } catch (error) {
        const retryable = error.code === "GHL_RATE_LIMITED";
        await markDetail(detail, retryable ? "failed_retryable" : "failed_final", {
          errorCode: error.code || "GHL_WORKFLOW_CONTACT_ERROR",
          mensaje: error.message,
        });
      } finally {
        await execution.update({ heartbeatAt: new Date() }).catch(() => {});
      }
    });
    const counters = await refreshCounters(execution);
    const estado = counters.totalFallido ? "partial" : "completed";
    await execution.update({ estado, finishedAt: new Date(), heartbeatAt: new Date() });
    console.log("[GHL_WORKFLOW] EXECUTION_FINISHED", {
      configuracionId: currentProgramacion.id,
      ejecucionId: execution.id,
      ventana: execution.ventanaProgramada,
      estado,
      paginasConsultadas: shared.pages,
      oportunidadesExaminadas: shared.opportunities.length,
      contactosUnicos: shared.byContact.size,
      procesados: counters.totalProcesado,
      omitidos: counters.totalOmitido,
      fallidos: counters.totalFallido,
      duracionMs: Date.now() - started,
    });
    return { skipped: false, code: estado === "partial" ? "EXECUTION_PARTIAL" : "EXECUTION_COMPLETED", execution };
  } catch (error) {
    await execution.update({
      estado: "failed",
      finishedAt: new Date(),
      heartbeatAt: new Date(),
      codigoGeneral: error.code || "GHL_WORKFLOW_EXECUTION_ERROR",
      mensajeGeneral: configurationService.sanitize(error.message),
    }).catch(() => {});
    console.error("[GHL_WORKFLOW] EXECUTION_FAILED", {
      configuracionId: programacion.id,
      ejecucionId: execution.id,
      codigo: error.code || "GHL_WORKFLOW_EXECUTION_ERROR",
      duracionMs: Date.now() - started,
    });
    throw error;
  } finally {
    await executionLock.release(lock);
  }
}

function scheduledWindow(programacion, now = new Date()) {
  const local = configurationService.localParts(now);
  if (!programacion.activo || !programacion.diasSemana.includes(local.day) || local.time < programacion.hora) return null;
  return {
    id: `${programacion.id}:${local.date}:${programacion.hora}`,
    date: local.date,
    scheduledFor: new Date(`${local.date}T${programacion.hora}:00-05:00`),
  };
}

async function executeScheduled(programacion, now = new Date()) {
  const window = scheduledWindow(programacion, now);
  if (!window) return { skipped: true, code: "NOT_DUE" };
  let execution;
  try {
    [execution] = await Ejecucion.findOrCreate({
      where: { configuracionId: programacion.id, ventanaProgramada: window.id },
      defaults: {
        tipo: "scheduled",
        estado: "pending",
        scheduledFor: window.scheduledFor,
        fechaLocal: window.date,
      },
    });
  } catch (error) {
    if (error.name !== "SequelizeUniqueConstraintError") throw error;
    execution = await Ejecucion.findOne({ where: { configuracionId: programacion.id, ventanaProgramada: window.id } });
  }
  return execute(programacion, execution);
}

async function recoverStaleRuns(now = new Date()) {
  const cutoff = new Date(now.getTime() - STALE_AFTER_MS);
  const staleRuns = await Ejecucion.findAll({
    where: { estado: "running", [Op.or]: [{ heartbeatAt: null }, { heartbeatAt: { [Op.lt]: cutoff } }] },
    attributes: ["id", "configuracionId"],
  });
  let recovered = 0;
  for (const staleRun of staleRuns) {
    const lock = await executionLock.acquire(`configuration:${staleRun.configuracionId}`);
    if (!lock) continue;
    try {
      const [count] = await Ejecucion.update(
        { estado: "interrupted", codigoGeneral: "STALE_HEARTBEAT", mensajeGeneral: "Ejecucion recuperable interrumpida por heartbeat vencido" },
        { where: {
          id: staleRun.id,
          estado: "running",
          [Op.or]: [{ heartbeatAt: null }, { heartbeatAt: { [Op.lt]: cutoff } }],
        } },
      );
      if (!count) continue;
      recovered += count;
      await Detalle.update({
        estado: "failed_final",
        processedAt: now,
        errorCode: "AMBIGUOUS_ENROLLMENT_RESULT",
        mensaje: "No se repitio una inscripcion cuyo resultado pudo quedar confirmado en HighLevel",
      }, { where: { ejecucionId: staleRun.id, estado: "processing" } });
    } finally {
      await executionLock.release(lock);
    }
  }
  return recovered;
}

async function listExecutions(query = {}) {
  const where = {};
  if (query.configuracionId) where.configuracionId = Number(query.configuracionId);
  if (query.estado) where.estado = String(query.estado);
  const limit = Math.min(200, Math.max(1, Number(query.limit) || 50));
  return Ejecucion.findAll({ where, order: [["scheduledFor", "DESC"]], limit, include: [{ association: "configuracion", attributes: ["id", "nombre", "workflowNombre"] }] });
}

module.exports = {
  STALE_AFTER_MS,
  CONCURRENCY,
  isEligibleOpportunity,
  collectEligible,
  preview,
  processDetail,
  hasPriorSuccess,
  revalidateContact,
  refreshCounters,
  scheduledWindow,
  executeScheduled,
  recoverStaleRuns,
  listExecutions,
};
