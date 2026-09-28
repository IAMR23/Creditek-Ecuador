const { Op } = require("sequelize");
const { sequelize } = require("../config/db");
const Ejecucion = require("../models/GhlDifusionEjecucion");
const Detalle = require("../models/GhlDifusionEjecucionDetalle");
const {
  getMessageHubProvider,
  previewBroadcast,
  validateMessage,
} = require("./ghlBroadcastService");
const { requestGhl, toId } = require("./ghlService");

const MESSAGE_HUB_VERSION = "v3";
const ACTIVE_STATES = ["pending", "running"];
const FINAL_STATES = ["completed", "partial", "cancelled"];
const DEFAULT_BATCH_SIZE = 3;
const DEFAULT_INTERVAL_MINUTES = 5;
const STALE_AFTER_MS = 10 * 60 * 1000;

const serviceError = (message, code, statusCode = 400) => {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  return error;
};

const integerInRange = (value, fallback, minimum, maximum, label) => {
  const parsed = value === undefined || value === null || value === ""
    ? fallback
    : Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw serviceError(
      `${label} debe estar entre ${minimum} y ${maximum}`,
      "GHL_BROADCAST_RATE_INVALID",
    );
  }
  return parsed;
};

const normalizeRate = (input = {}) => ({
  batchSize: integerInRange(input.batchSize, DEFAULT_BATCH_SIZE, 1, 20, "La cantidad por lote"),
  intervalMinutes: integerInRange(
    input.intervalMinutes,
    DEFAULT_INTERVAL_MINUTES,
    1,
    1440,
    "El intervalo en minutos",
  ),
});

const serializeExecution = (row, { includeDetails = false } = {}) => {
  const value = row?.toJSON ? row.toJSON() : row;
  const result = {
    id: String(value.id),
    estado: value.estado,
    batchSize: value.batchSize,
    intervalMinutes: value.intervalMinutes,
    tagName: value.tagName,
    total: value.total,
    processed: value.processed,
    sent: value.sent,
    failed: value.failed,
    tagged: value.tagged,
    tagFailed: value.tagFailed,
    excluded: value.excluded || [],
    startedAt: value.startedAt,
    finishedAt: value.finishedAt,
    nextBatchAt: value.nextBatchAt,
    createdAt: value.createdAt,
  };
  if (includeDetails) {
    result.details = (value.detalles || []).map((detail) => ({
      id: String(detail.id),
      contactId: detail.contactId,
      contactName: detail.contactName,
      instanceIndex: detail.instanceIndex,
      estado: detail.estado,
      sendError: detail.sendError,
      tagStatus: detail.tagStatus,
      tagError: detail.tagError,
      processedAt: detail.processedAt,
    }));
  }
  return result;
};

async function createExecution(input, userId, dependencies = {}) {
  if (input?.confirmation !== "ENVIAR") {
    throw serviceError(
      "La difusion requiere confirmacion explicita",
      "GHL_BROADCAST_CONFIRMATION_REQUIRED",
    );
  }
  const executionModel = dependencies.Ejecucion || Ejecucion;
  const detailModel = dependencies.Detalle || Detalle;
  const previewer = dependencies.previewBroadcast || previewBroadcast;
  const rate = normalizeRate(input);
  const preview = await previewer(input);
  const message = validateMessage(input.message);
  const active = await executionModel.findOne({ where: { estado: { [Op.in]: ACTIVE_STATES } } });
  if (active) {
    throw serviceError(
      "Ya existe una difusion en curso. Espere a que termine o cancelela.",
      "GHL_BROADCAST_ACTIVE_EXISTS",
      409,
    );
  }

  const transactionRunner = dependencies.transaction
    || ((callback) => sequelize.transaction(callback));
  let execution;
  try {
    execution = await transactionRunner(async (transaction) => {
      const created = await executionModel.create({
        estado: "pending",
        mensaje: message,
        instanceIndexes: preview.distribution.map((group) => group.instanceIndex),
        ...rate,
        tagName: "regestion",
        total: preview.totalEligible,
        excluded: preview.excluded,
        creadoPorId: userId,
        nextBatchAt: new Date(),
      }, { transaction });
      const details = preview.distribution.flatMap((group) => group.contacts.map((contact) => ({
        ejecucionId: created.id,
        contactId: contact.id,
        contactName: contact.name,
        instanceIndex: group.instanceIndex,
        estado: "pending",
        tagStatus: "pending",
      })));
      await detailModel.bulkCreate(details, { transaction });
      return created;
    });
  } catch (error) {
    if (error.name === "SequelizeUniqueConstraintError") {
      throw serviceError(
        "Ya existe una difusion en curso. Espere a que termine o cancelela.",
        "GHL_BROADCAST_ACTIVE_EXISTS",
        409,
      );
    }
    throw error;
  }

  return serializeExecution(execution);
}

async function claimBatch(executionId, now = new Date(), dependencies = {}) {
  const executionModel = dependencies.Ejecucion || Ejecucion;
  const detailModel = dependencies.Detalle || Detalle;
  const transactionRunner = dependencies.transaction
    || ((callback) => sequelize.transaction(callback));
  return transactionRunner(async (transaction) => {
    const execution = await executionModel.findByPk(executionId, {
      transaction,
      lock: transaction.LOCK?.UPDATE,
    });
    if (!execution || !ACTIVE_STATES.includes(execution.estado)) return null;
    if (execution.nextBatchAt && new Date(execution.nextBatchAt) > now) return null;
    const details = await detailModel.findAll({
      where: { ejecucionId: execution.id, estado: "pending" },
      order: [["id", "ASC"]],
      limit: execution.batchSize,
      transaction,
      lock: transaction.LOCK?.UPDATE,
    });
    if (!details.length) return { execution, details: [] };

    await detailModel.update(
      { estado: "processing" },
      { where: { id: { [Op.in]: details.map((detail) => detail.id) } }, transaction },
    );
    await execution.update({
      estado: "running",
      startedAt: execution.startedAt || now,
      heartbeatAt: now,
      nextBatchAt: new Date(now.getTime() + execution.intervalMinutes * 60 * 1000),
    }, { transaction });
    return { execution, details };
  });
}

async function refreshExecution(executionId, now = new Date(), dependencies = {}) {
  const executionModel = dependencies.Ejecucion || Ejecucion;
  const detailModel = dependencies.Detalle || Detalle;
  const [current, sent, failed, pending, processing, tagged, tagFailed] = await Promise.all([
    executionModel.findByPk(executionId),
    detailModel.count({ where: { ejecucionId: executionId, estado: "sent" } }),
    detailModel.count({ where: { ejecucionId: executionId, estado: "failed" } }),
    detailModel.count({ where: { ejecucionId: executionId, estado: "pending" } }),
    detailModel.count({ where: { ejecucionId: executionId, estado: "processing" } }),
    detailModel.count({ where: { ejecucionId: executionId, tagStatus: "tagged" } }),
    detailModel.count({ where: { ejecucionId: executionId, tagStatus: "failed" } }),
  ]);
  const done = pending + processing === 0;
  const changes = {
    processed: sent + failed,
    sent,
    failed,
    tagged,
    tagFailed,
    heartbeatAt: now,
  };
  if (done && current?.estado !== "cancelled") {
    changes.estado = failed || tagFailed ? "partial" : "completed";
    changes.finishedAt = now;
  }
  await executionModel.update(changes, { where: { id: executionId } });
  return executionModel.findByPk(executionId);
}

async function processBatch(executionId, now = new Date(), dependencies = {}) {
  const executeRequest = dependencies.requestGhl || requestGhl;
  const providerLoader = dependencies.getMessageHubProvider || getMessageHubProvider;
  const detailModel = dependencies.Detalle || Detalle;
  const claimed = await claimBatch(executionId, now, dependencies);
  if (!claimed) return null;
  if (!claimed.details.length) return refreshExecution(executionId, now, dependencies);

  let hub;
  let hubError;
  try {
    hub = await providerLoader(dependencies);
  } catch (error) {
    hubError = error;
  }
  const providerId = hub ? toId(hub.provider?._id || hub.provider?.id) : "";

  for (const detail of claimed.details) {
    let sendResult = { estado: "failed", sendError: hubError?.message || "Message Hub no disponible" };
    let tagResult = {
      tagStatus: "skipped",
      tagError: hubError?.message || "No se agrego la etiqueta porque el mensaje no fue enviado",
    };

    if (hub) {
      try {
        const payload = await executeRequest(hub.client, {
          method: "POST",
          url: "/conversations/messages",
          headers: { Version: MESSAGE_HUB_VERSION, "Content-Type": "application/json" },
          data: {
            type: "SMS",
            contactId: detail.contactId,
            conversationProviderId: providerId,
            message: `${claimed.execution.mensaje}\n\n{ WA#${detail.instanceIndex} }`,
          },
          maxRetries: 0,
        });
        sendResult = {
          estado: "sent",
          messageId: toId(payload?.messageId || payload?.data?.messageId) || null,
          sendError: null,
        };
      } catch (error) {
        sendResult = { estado: "failed", sendError: error.message || "No se pudo enviar" };
      }

      if (sendResult.estado === "sent") {
        try {
          await executeRequest(hub.client, {
            method: "POST",
            url: `/contacts/${encodeURIComponent(detail.contactId)}/tags`,
            headers: { Version: MESSAGE_HUB_VERSION, "Content-Type": "application/json" },
            data: { tags: [claimed.execution.tagName] },
            maxRetries: 2,
          });
          tagResult = { tagStatus: "tagged", tagError: null };
        } catch (error) {
          tagResult = { tagStatus: "failed", tagError: error.message || "No se pudo agregar la etiqueta" };
        }
      }
    }

    await detailModel.update({
      ...sendResult,
      ...tagResult,
      processedAt: new Date(),
    }, { where: { id: detail.id, estado: "processing" } });
  }

  return refreshExecution(executionId, new Date(), dependencies);
}

async function processDueExecutions(now = new Date(), dependencies = {}) {
  const executionModel = dependencies.Ejecucion || Ejecucion;
  const rows = await executionModel.findAll({
    where: {
      estado: { [Op.in]: ACTIVE_STATES },
      nextBatchAt: { [Op.lte]: now },
    },
    order: [["nextBatchAt", "ASC"]],
    limit: 10,
  });
  const results = [];
  for (const row of rows) results.push(await processBatch(row.id, now, dependencies));
  return results.filter(Boolean);
}

async function recoverStaleExecutions(now = new Date(), dependencies = {}) {
  const executionModel = dependencies.Ejecucion || Ejecucion;
  const detailModel = dependencies.Detalle || Detalle;
  const cutoff = new Date(now.getTime() - STALE_AFTER_MS);
  const rows = await executionModel.findAll({
    where: {
      estado: "running",
      [Op.or]: [{ heartbeatAt: null }, { heartbeatAt: { [Op.lt]: cutoff } }],
    },
  });
  for (const row of rows) {
    await detailModel.update({
      estado: "failed",
      sendError: "Resultado ambiguo tras reinicio; no se reintento para evitar duplicados",
      tagStatus: "failed",
      tagError: "Resultado ambiguo tras reinicio",
      processedAt: now,
    }, { where: { ejecucionId: row.id, estado: "processing" } });
    await row.update({ nextBatchAt: now, heartbeatAt: now });
    await refreshExecution(row.id, now, dependencies);
  }
  return rows.length;
}

async function getExecution(id, dependencies = {}) {
  const executionModel = dependencies.Ejecucion || Ejecucion;
  const row = await executionModel.findByPk(id, {
    include: [{ association: "detalles", required: false }],
    order: [[{ model: Detalle, as: "detalles" }, "id", "ASC"]],
  });
  if (!row) throw serviceError("Difusion no encontrada", "GHL_BROADCAST_EXECUTION_NOT_FOUND", 404);
  return serializeExecution(row, { includeDetails: true });
}

async function getActiveExecution(dependencies = {}) {
  const executionModel = dependencies.Ejecucion || Ejecucion;
  const row = await executionModel.findOne({
    where: { estado: { [Op.in]: ACTIVE_STATES } },
    order: [["createdAt", "DESC"]],
  });
  return row ? serializeExecution(row) : null;
}

async function cancelExecution(id, dependencies = {}) {
  const executionModel = dependencies.Ejecucion || Ejecucion;
  const detailModel = dependencies.Detalle || Detalle;
  const row = await executionModel.findByPk(id);
  if (!row) throw serviceError("Difusion no encontrada", "GHL_BROADCAST_EXECUTION_NOT_FOUND", 404);
  if (FINAL_STATES.includes(row.estado)) return serializeExecution(row);
  await detailModel.update(
    { estado: "cancelled", tagStatus: "cancelled", processedAt: new Date() },
    { where: { ejecucionId: row.id, estado: "pending" } },
  );
  await row.update({ estado: "cancelled", finishedAt: new Date(), heartbeatAt: new Date() });
  return serializeExecution(row);
}

module.exports = {
  ACTIVE_STATES,
  DEFAULT_BATCH_SIZE,
  DEFAULT_INTERVAL_MINUTES,
  STALE_AFTER_MS,
  cancelExecution,
  claimBatch,
  createExecution,
  getActiveExecution,
  getExecution,
  normalizeRate,
  processBatch,
  processDueExecutions,
  recoverStaleExecutions,
  refreshExecution,
  serializeExecution,
};
