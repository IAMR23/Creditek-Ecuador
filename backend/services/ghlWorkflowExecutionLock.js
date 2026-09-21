const { sequelize } = require("../config/db");

const PREFIX = "ghl-workflow-programado";

async function acquire(scope) {
  const key = `${PREFIX}:${String(scope)}`;
  const connection = await sequelize.connectionManager.getConnection();
  try {
    const result = await connection.query(
      "SELECT pg_try_advisory_lock(hashtext($1)) AS locked",
      [key],
    );
    if (!result.rows?.[0]?.locked) {
      await sequelize.connectionManager.releaseConnection(connection);
      return null;
    }
    return { key, connection };
  } catch (error) {
    await sequelize.connectionManager.releaseConnection(connection).catch(() => {});
    throw error;
  }
}

async function release(handle) {
  if (!handle?.connection) return;
  try {
    await handle.connection.query(
      "SELECT pg_advisory_unlock(hashtext($1))",
      [handle.key],
    );
  } finally {
    await sequelize.connectionManager.releaseConnection(handle.connection);
    handle.connection = null;
  }
}

module.exports = { PREFIX, acquire, release };
