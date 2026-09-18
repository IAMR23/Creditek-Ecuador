const { sequelize } = require("../config/db");
const RevisionPendiente = require("../models/GhlRepartoRevisionPendiente");
const distributionLock = require("./ghlDistributionExecutionLock");

const localWorkers = new Map();
const DEFAULT_BUSY_RETRY_MS = 500;
const MAX_PASSES_PER_DRAIN = 3;
const DEFAULT_RETRY_BASE_MS = 60_000;
const DEFAULT_RETRY_MAX_MS = 30 * 60_000;

const normalizeLocationId = (value) => String(value || "").trim();
const normalizeTrigger = (value) => String(value || "play")
  .replace(/[^a-z0-9_-]/gi, "")
  .slice(0, 30) || "play";
const normalizeFailureCode = (value) => String(value || "GHL_REPARTO_ERROR")
  .replace(/[^a-z0-9_-]/gi, "")
  .slice(0, 80) || "GHL_REPARTO_ERROR";

const retryBackoffMs = (failureCount, env = process.env) => {
  const configuredBase = Number(env.GHL_REPARTO_RETRY_BASE_MS);
  const configuredMaximum = Number(env.GHL_REPARTO_RETRY_MAX_MS);
  const base = Number.isFinite(configuredBase) && configuredBase >= 1_000
    ? configuredBase
    : DEFAULT_RETRY_BASE_MS;
  const maximum = Number.isFinite(configuredMaximum) && configuredMaximum >= base
    ? configuredMaximum
    : DEFAULT_RETRY_MAX_MS;
  const exponent = Math.max(0, Math.min(10, Number(failureCount || 1) - 1));
  return Math.min(maximum, base * (2 ** exponent));
};

const delay = (ms) => new Promise((resolve) => {
  const timer = setTimeout(resolve, ms);
  timer.unref?.();
});

const awaitDatabase = (promise, timeoutMs = distributionLock.connectionAcquireMs()) => {
  let timer;
  const deadline = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const error = new Error(`La coordinacion SQL del reparto excedio ${timeoutMs} ms`);
      error.code = "GHL_REVIEW_DB_TIMEOUT";
      error.statusCode = 503;
      reject(error);
    }, timeoutMs);
    timer.unref?.();
  });
  return Promise.race([Promise.resolve(promise), deadline]).finally(() => clearTimeout(timer));
};

async function persistRequest(locationId, trigger) {
  const [rows] = await awaitDatabase(sequelize.query(`
    INSERT INTO ghl_reparto_revisiones_pendientes (
      "locationId", "requestedVersion", "processedVersion", "lastTrigger",
      "requestedAt", "createdAt", "updatedAt"
    ) VALUES ($locationId, 1, 0, $trigger, NOW(), NOW(), NOW())
    ON CONFLICT ("locationId") DO UPDATE SET
      "requestedVersion" = ghl_reparto_revisiones_pendientes."requestedVersion" + 1,
      "lastTrigger" = EXCLUDED."lastTrigger",
      "requestedAt" = NOW(),
      "updatedAt" = NOW()
    RETURNING "requestedVersion"
  `, { bind: { locationId, trigger } }));
  return Number(rows?.[0]?.requestedVersion || 0);
}

async function acquireWorkerLock(locationId) {
  const connection = await distributionLock.acquireConnection();
  try {
    const result = await distributionLock.queryConnection(
      connection,
      "SELECT pg_try_advisory_lock(hashtext($1)) AS locked",
      [`ghl-reparto-review:location:${locationId}`],
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

async function releaseWorkerLock(connection, locationId) {
  if (!connection) return;
  let connectionDestroyed = false;
  try {
    await distributionLock.queryConnection(
      connection,
      "SELECT pg_advisory_unlock(hashtext($1))",
      [`ghl-reparto-review:location:${locationId}`],
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

const snapshotOf = (row) => {
  if (!row) return null;
  const value = typeof row.toJSON === "function" ? row.toJSON() : row;
  return {
    requestedVersion: Number(value.requestedVersion || 0),
    processedVersion: Number(value.processedVersion || 0),
    lastTrigger: normalizeTrigger(value.lastTrigger),
    failureCount: Number(value.failureCount || 0),
    retryAfter: value.retryAfter ? new Date(value.retryAfter) : null,
    lastFailureCode: value.lastFailureCode || null,
  };
};

async function getRetryState(locationId, now = new Date()) {
  const snapshot = snapshotOf(await awaitDatabase(RevisionPendiente.findByPk(locationId)));
  const retryAfter = snapshot?.retryAfter;
  return {
    suspended: Boolean(retryAfter && retryAfter.getTime() > now.getTime()),
    retryAfter: retryAfter?.toISOString?.() || null,
    failureCount: snapshot?.failureCount || 0,
    lastFailureCode: snapshot?.lastFailureCode || null,
  };
}

async function recordFailure(locationId, errorCode, now = new Date()) {
  const normalizedLocationId = normalizeLocationId(locationId);
  if (!normalizedLocationId) throw new TypeError("locationId es obligatorio");
  return awaitDatabase(sequelize.transaction(async (transaction) => {
    const row = await RevisionPendiente.findByPk(normalizedLocationId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    const current = snapshotOf(row);
    const failureCount = (current?.failureCount || 0) + 1;
    const retryAfter = new Date(now.getTime() + retryBackoffMs(failureCount));
    const values = {
      failureCount,
      retryAfter,
      lastFailureCode: normalizeFailureCode(errorCode),
    };
    if (row) {
      await RevisionPendiente.update(values, {
        where: { locationId: normalizedLocationId },
        transaction,
      });
    } else {
      await RevisionPendiente.create({
        locationId: normalizedLocationId,
        requestedVersion: 0,
        processedVersion: 0,
        lastTrigger: "scheduler",
        requestedAt: now,
        ...values,
      }, { transaction });
    }
    return { ...values, retryAfter: retryAfter.toISOString() };
  }));
}

async function clearFailures(locationId) {
  await awaitDatabase(RevisionPendiente.update({
    failureCount: 0,
    retryAfter: null,
    lastFailureCode: null,
  }, { where: { locationId } }));
}

async function markProcessed(locationId, targetVersion) {
  await awaitDatabase(RevisionPendiente.update({
    processedVersion: targetVersion,
    processedAt: new Date(),
  }, {
    where: { locationId },
  }));
}

async function hasPending(locationId) {
  const snapshot = snapshotOf(await awaitDatabase(RevisionPendiente.findByPk(locationId)));
  return Boolean(snapshot && snapshot.requestedVersion > snapshot.processedVersion);
}

async function drain(locationId, executeQueue) {
  const workerLock = await acquireWorkerLock(locationId);
  if (!workerLock) return { code: "REVIEW_GROUPED_OTHER_PROCESS", pending: true };
  let passes = 0;
  const busyDeadline = Date.now() + distributionLock.maxExecutionMs() * 2;
  try {
    while (passes < MAX_PASSES_PER_DRAIN) {
      const snapshot = snapshotOf(await awaitDatabase(RevisionPendiente.findByPk(locationId)));
      if (!snapshot || snapshot.requestedVersion <= snapshot.processedVersion) {
        return { code: passes ? "REVIEW_PROCESSED" : "NO_PENDING_REVIEW", passes };
      }

      let result;
      try {
        result = await executeQueue({
          trigger: `${snapshot.lastTrigger}-review`.slice(0, 30),
          quietIfBusy: true,
        });
      } catch (error) {
        console.error("[GHL] REVISION_PENDIENTE_ERROR", {
          codigo: error.code || "GHL_REALTIME_REVIEW_ERROR",
        });
        // No confirmar la version: el scheduler la recuperara en su siguiente
        // ciclo. Esto evita perder Play ante un error transitorio y tambien
        // evita un bucle local de reintentos sin pausa.
        return { code: "REVIEW_FAILED_PENDING", passes, pending: true };
      }

      if (result?.code === "PREVIOUS_EXECUTION_RUNNING") {
        if (Date.now() >= busyDeadline) {
          return { code: "REVIEW_STILL_PENDING", passes, pending: true };
        }
        await delay(DEFAULT_BUSY_RETRY_MS);
        continue;
      }

      if (result?.code === "GHL_REPARTO_SUSPENDED") {
        return { code: "REVIEW_SUSPENDED", passes, pending: true };
      }

      await markProcessed(locationId, snapshot.requestedVersion);
      passes += 1;
    }
    return {
      code: "REVIEW_PASS_LIMIT",
      passes,
      pending: await hasPending(locationId),
    };
  } finally {
    await releaseWorkerLock(workerLock, locationId);
  }
}

function scheduleWorker(locationId, executeQueue, delayMs = 0) {
  if (localWorkers.has(locationId)) return localWorkers.get(locationId);
  const worker = (async () => {
    if (delayMs > 0) await delay(delayMs);
    return drain(locationId, executeQueue);
  })();
  localWorkers.set(locationId, worker);
  worker.then(() => {
    localWorkers.delete(locationId);
  }, (error) => {
    localWorkers.delete(locationId);
    console.error("[GHL] REVISION_PENDIENTE_ERROR", {
      codigo: error.code || "GHL_REALTIME_REVIEW_COORDINATION_ERROR",
    });
  });
  return worker;
}

async function requestReview({ locationId, trigger = "play", executeQueue }) {
  const normalizedLocationId = normalizeLocationId(locationId);
  if (!normalizedLocationId) {
    const error = new Error("No se pudo determinar locationId para registrar la revision pendiente");
    error.code = "GHL_LOCATION_ID_MISSING";
    throw error;
  }
  if (typeof executeQueue !== "function") {
    throw new TypeError("executeQueue es obligatorio");
  }
  const normalizedTrigger = normalizeTrigger(trigger);
  const requestedVersion = await persistRequest(normalizedLocationId, normalizedTrigger);
  scheduleWorker(normalizedLocationId, executeQueue);
  return { code: "REVIEW_PENDING", requestedVersion };
}

async function recoverPendingReviews({ executeQueue }) {
  if (typeof executeQueue !== "function") {
    throw new TypeError("executeQueue es obligatorio");
  }
  const rows = await awaitDatabase(RevisionPendiente.findAll());
  const pending = rows
    .map((row) => ({ row, snapshot: snapshotOf(row) }))
    .filter(({ snapshot }) => snapshot && snapshot.requestedVersion > snapshot.processedVersion);
  pending.forEach(({ row }) => {
    const value = typeof row.toJSON === "function" ? row.toJSON() : row;
    const locationId = normalizeLocationId(value.locationId);
    if (locationId) scheduleWorker(locationId, executeQueue);
  });
  return { pendingCount: pending.length };
}

module.exports = {
  DEFAULT_BUSY_RETRY_MS,
  MAX_PASSES_PER_DRAIN,
  DEFAULT_RETRY_BASE_MS,
  DEFAULT_RETRY_MAX_MS,
  localWorkers,
  normalizeTrigger,
  snapshotOf,
  retryBackoffMs,
  getRetryState,
  recordFailure,
  clearFailures,
  persistRequest,
  acquireWorkerLock,
  releaseWorkerLock,
  markProcessed,
  hasPending,
  drain,
  scheduleWorker,
  requestReview,
  recoverPendingReviews,
};
