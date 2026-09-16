const { sequelize } = require("../config/db");

const DEFAULT_MAX_EXECUTION_MS = 180_000;
const MIN_MAX_EXECUTION_MS = 10_000;
const activeByLocation = new Map();

const maxExecutionMs = (env = process.env) => {
  const requested = Number(env.GHL_REPARTO_MAX_EXECUTION_MS);
  return Number.isFinite(requested) && requested >= MIN_MAX_EXECUTION_MS
    ? requested
    : DEFAULT_MAX_EXECUTION_MS;
};

const keyForLocation = (locationId) => String(locationId || "").trim();
const advisoryScope = (locationId) => `location:${keyForLocation(locationId)}`;

function logOmitted(active = null) {
  console.log("[GHL] REPARTO_OMITIDO", {
    motivo: "PREVIOUS_EXECUTION_RUNNING",
    inicioEjecucionActual: active?.startedAt?.toISOString?.() || null,
    duracionActualMs: active?.startedAt
      ? Math.max(0, Date.now() - active.startedAt.getTime())
      : null,
  });
}

async function acquire(locationId) {
  const key = keyForLocation(locationId);
  if (!key) {
    const error = new Error("No se pudo determinar locationId para coordinar el reparto GHL");
    error.code = "GHL_LOCATION_ID_MISSING";
    error.statusCode = 500;
    throw error;
  }

  const current = activeByLocation.get(key);
  if (current) {
    logOmitted(current);
    return null;
  }

  const handle = {
    key,
    scope: advisoryScope(key),
    startedAt: new Date(),
    controller: new AbortController(),
    connection: null,
  };
  activeByLocation.set(key, handle);

  try {
    handle.connection = await sequelize.connectionManager.getConnection();
    const result = await handle.connection.query(
      "SELECT pg_try_advisory_lock(hashtext($1)) AS locked",
      [`ghl-reparto:${handle.scope}`],
    );
    if (!result.rows?.[0]?.locked) {
      await sequelize.connectionManager.releaseConnection(handle.connection);
      handle.connection = null;
      activeByLocation.delete(key);
      logOmitted();
      return null;
    }
    return handle;
  } catch (error) {
    if (activeByLocation.get(key) === handle) activeByLocation.delete(key);
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
  try {
    await handle.connection.query(
      "SELECT pg_advisory_unlock(hashtext($1))",
      [`ghl-reparto:${handle.scope}`],
    );
  } finally {
    await sequelize.connectionManager.releaseConnection(handle.connection);
  }
}

function timeoutError(timeoutMs) {
  const error = new Error(`El reparto GHL excedio el tiempo maximo de ${timeoutMs} ms`);
  error.code = "GHL_EXECUTION_TIMEOUT";
  error.statusCode = 504;
  return error;
}

async function runWithTimeout(handle, operation, timeoutMs = maxExecutionMs()) {
  let timer;
  const deadline = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const error = timeoutError(timeoutMs);
      handle.controller.abort(error);
      reject(error);
    }, timeoutMs);
    timer.unref?.();
  });
  try {
    return await Promise.race([Promise.resolve().then(operation), deadline]);
  } finally {
    clearTimeout(timer);
  }
}

function throwIfAborted(handle) {
  if (!handle?.controller.signal.aborted) return;
  throw handle.controller.signal.reason || timeoutError(maxExecutionMs());
}

module.exports = {
  DEFAULT_MAX_EXECUTION_MS,
  MIN_MAX_EXECUTION_MS,
  activeByLocation,
  maxExecutionMs,
  advisoryScope,
  logOmitted,
  acquire,
  release,
  runWithTimeout,
  throwIfAborted,
};
