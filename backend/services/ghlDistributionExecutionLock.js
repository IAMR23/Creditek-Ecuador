const { sequelize } = require("../config/db");

const DEFAULT_MAX_EXECUTION_MS = 180_000;
const MIN_MAX_EXECUTION_MS = 10_000;
const DEFAULT_CONNECTION_ACQUIRE_MS = 10_000;
const DEFAULT_LOCK_QUERY_MS = 5_000;
const DEFAULT_CANCELLATION_GRACE_MS = 30_000;
const DEFAULT_LONG_RUNNING_MS = 60_000;
const DEFAULT_LONG_RUNNING_INTERVAL_MS = 60_000;
const activeByLocation = new Map();

const maxExecutionMs = (env = process.env) => {
  const requested = Number(env.GHL_REPARTO_MAX_EXECUTION_MS);
  return Number.isFinite(requested) && requested >= MIN_MAX_EXECUTION_MS
    ? requested
    : DEFAULT_MAX_EXECUTION_MS;
};

const keyForLocation = (locationId) => String(locationId || "").trim();
const advisoryScope = (locationId) => `location:${keyForLocation(locationId)}`;

const boundedEnvMs = (name, fallback, minimum = 100) => {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value >= minimum ? value : fallback;
};

const connectionAcquireMs = () => boundedEnvMs(
  "GHL_REPARTO_CONNECTION_ACQUIRE_MS",
  DEFAULT_CONNECTION_ACQUIRE_MS,
);

const lockQueryMs = () => boundedEnvMs("GHL_REPARTO_LOCK_QUERY_MS", DEFAULT_LOCK_QUERY_MS);
const cancellationGraceMs = () => boundedEnvMs(
  "GHL_REPARTO_CANCELLATION_GRACE_MS",
  DEFAULT_CANCELLATION_GRACE_MS,
  1_000,
);

async function destroyConnection(connection) {
  if (!connection) return;
  if (typeof sequelize.connectionManager.destroyConnection === "function") {
    await sequelize.connectionManager.destroyConnection(connection).catch(() => {});
    return;
  }
  await sequelize.connectionManager.releaseConnection(connection).catch(() => {});
}

async function queryConnection(connection, text, values, timeoutMs = lockQueryMs()) {
  let timer;
  const query = Promise.resolve().then(() => connection.query(text, values));
  const deadline = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const error = new Error(`La operacion SQL del lock excedio ${timeoutMs} ms`);
      error.code = "GHL_LOCK_QUERY_TIMEOUT";
      error.statusCode = 503;
      reject(error);
    }, timeoutMs);
    timer.unref?.();
  });
  try {
    return await Promise.race([query, deadline]);
  } catch (error) {
    if (error.code === "GHL_LOCK_QUERY_TIMEOUT") {
      error.connectionDestroyed = true;
      await destroyConnection(connection);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function acquireConnection(timeoutMs = connectionAcquireMs()) {
  let expired = false;
  let timer;
  const acquisition = Promise.resolve(sequelize.connectionManager.getConnection())
    .then(async (connection) => {
      if (!expired) return connection;
      await sequelize.connectionManager.releaseConnection(connection).catch(() => {});
      return null;
    });
  const deadline = new Promise((_, reject) => {
    timer = setTimeout(() => {
      expired = true;
      const error = new Error(`No se obtuvo una conexion PostgreSQL en ${timeoutMs} ms`);
      error.code = "GHL_DB_CONNECTION_TIMEOUT";
      error.statusCode = 503;
      reject(error);
    }, timeoutMs);
    timer.unref?.();
  });
  try {
    return await Promise.race([acquisition, deadline]);
  } finally {
    clearTimeout(timer);
  }
}

function progressSnapshot(handle) {
  return {
    faseActual: handle?.phase || null,
    paginasConsultadas: Number(handle?.progress?.pagesConsulted || 0),
    oportunidadesExaminadas: Number(handle?.progress?.opportunitiesExamined || 0),
    asignacionesRealizadas: Number(handle?.progress?.assignmentsCompleted || 0),
  };
}

function updateProgress(handle, { phase, pagesConsulted, opportunitiesExamined, assignmentsCompleted } = {}) {
  if (!handle) return;
  if (phase) handle.phase = String(phase);
  if (Number.isFinite(pagesConsulted)) handle.progress.pagesConsulted = pagesConsulted;
  if (Number.isFinite(opportunitiesExamined)) handle.progress.opportunitiesExamined = opportunitiesExamined;
  if (Number.isFinite(assignmentsCompleted)) handle.progress.assignmentsCompleted = assignmentsCompleted;
}

function logOmitted(active = null) {
  console.log("[GHL] REPARTO_OMITIDO", {
    motivo: "PREVIOUS_EXECUTION_RUNNING",
    inicioEjecucionActual: active?.startedAt?.toISOString?.() || null,
    duracionActualMs: active?.startedAt
      ? Math.max(0, Date.now() - active.startedAt.getTime())
      : null,
    ...(active ? progressSnapshot(active) : {}),
  });
}

async function acquire(locationId, { logIfUnavailable = true } = {}) {
  const key = keyForLocation(locationId);
  if (!key) {
    const error = new Error("No se pudo determinar locationId para coordinar el reparto GHL");
    error.code = "GHL_LOCATION_ID_MISSING";
    error.statusCode = 500;
    throw error;
  }

  const current = activeByLocation.get(key);
  if (current) {
    if (logIfUnavailable) logOmitted(current);
    return null;
  }

  const handle = {
    key,
    scope: advisoryScope(key),
    startedAt: new Date(),
    controller: new AbortController(),
    connection: null,
    phase: "ADVISORY_LOCK",
    progress: {
      pagesConsulted: 0,
      opportunitiesExamined: 0,
      assignmentsCompleted: 0,
    },
  };
  activeByLocation.set(key, handle);

  try {
    handle.connection = await acquireConnection();
    const result = await queryConnection(
      handle.connection,
      "SELECT pg_try_advisory_lock(hashtext($1)) AS locked",
      [`ghl-reparto:${handle.scope}`],
    );
    if (!result.rows?.[0]?.locked) {
      await sequelize.connectionManager.releaseConnection(handle.connection);
      handle.connection = null;
      activeByLocation.delete(key);
      if (logIfUnavailable) logOmitted();
      return null;
    }
    return handle;
  } catch (error) {
    if (activeByLocation.get(key) === handle) activeByLocation.delete(key);
    if (error.connectionDestroyed) handle.connection = null;
    if (handle.connection) {
      await sequelize.connectionManager.releaseConnection(handle.connection).catch(() => {});
    }
    throw error;
  }
}

async function release(handle) {
  if (!handle) return;
  if (activeByLocation.get(handle.key) === handle) activeByLocation.delete(handle.key);
  if (!handle.connection) return;
  let connectionDestroyed = false;
  try {
    await queryConnection(
      handle.connection,
      "SELECT pg_advisory_unlock(hashtext($1))",
      [`ghl-reparto:${handle.scope}`],
    );
  } catch (error) {
    connectionDestroyed = Boolean(error.connectionDestroyed);
    throw error;
  } finally {
    if (!connectionDestroyed) {
      await sequelize.connectionManager.releaseConnection(handle.connection);
    }
    handle.connection = null;
  }
}

function timeoutError(timeoutMs) {
  const error = new Error(`El reparto GHL excedio el tiempo maximo de ${timeoutMs} ms`);
  error.code = "GHL_EXECUTION_TIMEOUT";
  error.statusCode = 504;
  return error;
}

const logUnresponsiveOperation = (error, handle) => {
  console.error("[GHL] REPARTO_EN_CUARENTENA", {
    codigo: error.code,
    faseActual: error.phase || null,
    ...progressSnapshot(handle),
  });
};

async function runWithTimeout(
  handle,
  operation,
  timeoutMs = maxExecutionMs(),
  {
    onUnresponsive = null,
    cancellationGrace = cancellationGraceMs(),
  } = {},
) {
  let timer;
  let warningTimer;
  let warningInterval;
  const timeout = timeoutError(timeoutMs);
  const operationPromise = Promise.resolve().then(operation);
  const deadline = new Promise((resolve) => {
    timer = setTimeout(() => {
      handle.controller.abort(timeout);
      resolve({ timedOut: true });
    }, timeoutMs);
    timer.unref?.();
  });
  const warn = () => console.warn("[GHL] REPARTO_PROLONGADO", {
    inicioEjecucion: handle.startedAt.toISOString(),
    duracionMs: Math.max(0, Date.now() - handle.startedAt.getTime()),
    ...progressSnapshot(handle),
  });
  const warningAfterMs = boundedEnvMs("GHL_REPARTO_LONG_RUNNING_MS", DEFAULT_LONG_RUNNING_MS, 1_000);
  const warningEveryMs = boundedEnvMs(
    "GHL_REPARTO_LONG_RUNNING_INTERVAL_MS",
    DEFAULT_LONG_RUNNING_INTERVAL_MS,
    1_000,
  );
  warningTimer = setTimeout(() => {
    warn();
    warningInterval = setInterval(warn, warningEveryMs);
    warningInterval.unref?.();
  }, warningAfterMs);
  warningTimer.unref?.();
  try {
    const outcome = await Promise.race([
      operationPromise.then((value) => ({ value }), (error) => ({ error })),
      deadline,
    ]);
    if (!outcome.timedOut) {
      if (outcome.error) throw outcome.error;
      return outcome.value;
    }

    // El lock se conserva durante una gracia acotada mientras la operacion
    // observa AbortSignal. Si no responde, el reparto entra en cuarentena y
    // conserva el lock hasta que el trabajo anterior termine. El resto del
    // backend sigue atendiendo solicitudes y no entra en un ciclo de reinicio.
    let graceTimer;
    const settled = await Promise.race([
      operationPromise.then(() => true, () => true),
      new Promise((resolve) => {
        graceTimer = setTimeout(() => resolve(false), cancellationGrace);
        graceTimer.unref?.();
      }),
    ]);
    clearTimeout(graceTimer);
    if (!settled) {
      const unresponsive = new Error(
        `El reparto no termino ${cancellationGrace} ms despues de solicitar cancelacion`,
      );
      unresponsive.code = "GHL_CANCELLATION_UNRESPONSIVE";
      unresponsive.statusCode = 503;
      unresponsive.phase = handle.phase;
      logUnresponsiveOperation(unresponsive, handle);
      if (typeof onUnresponsive === "function") {
        await onUnresponsive(unresponsive).catch((error) => {
          console.error("[GHL] REPARTO_CUARENTENA_NO_PERSISTIDA", {
            codigo: error.code || "GHL_REPARTO_BACKOFF_ERROR",
          });
        });
      }
      // No usar Promise.race aqui: liberar el advisory lock permitiria una
      // segunda asignacion mientras el PUT anterior aun puede completarse.
      await operationPromise.then(() => {}, () => {});
      throw unresponsive;
    }
    throw timeout;
  } finally {
    clearTimeout(timer);
    clearTimeout(warningTimer);
    clearInterval(warningInterval);
  }
}

function throwIfAborted(handle) {
  if (!handle?.controller.signal.aborted) return;
  throw handle.controller.signal.reason || timeoutError(maxExecutionMs());
}

module.exports = {
  DEFAULT_MAX_EXECUTION_MS,
  MIN_MAX_EXECUTION_MS,
  DEFAULT_CONNECTION_ACQUIRE_MS,
  DEFAULT_LOCK_QUERY_MS,
  DEFAULT_CANCELLATION_GRACE_MS,
  activeByLocation,
  maxExecutionMs,
  connectionAcquireMs,
  lockQueryMs,
  cancellationGraceMs,
  acquireConnection,
  destroyConnection,
  queryConnection,
  advisoryScope,
  logOmitted,
  progressSnapshot,
  updateProgress,
  acquire,
  release,
  runWithTimeout,
  throwIfAborted,
};
