const { sequelize } = require("../config/db");
const workflowLock = require("./ghlWorkflowExecutionLock");

afterEach(() => jest.restoreAllMocks());

describe("advisory lock independiente para workflows GHL", () => {
  test("usa un scope propio y conserva la misma conexion hasta liberar", async () => {
    const connection = {
      query: jest.fn()
        .mockResolvedValueOnce({ rows: [{ locked: true }] })
        .mockResolvedValueOnce({ rows: [{ pg_advisory_unlock: true }] }),
    };
    jest.spyOn(sequelize.connectionManager, "getConnection").mockResolvedValue(connection);
    const releaseConnection = jest.spyOn(sequelize.connectionManager, "releaseConnection").mockResolvedValue();

    const handle = await workflowLock.acquire("configuration:7");

    expect(handle.key).toBe("ghl-workflow-programado:configuration:7");
    expect(handle.key).not.toContain("ghl-reparto:");
    expect(releaseConnection).not.toHaveBeenCalled();
    await workflowLock.release(handle);
    expect(connection.query).toHaveBeenCalledTimes(2);
    expect(releaseConnection).toHaveBeenCalledWith(connection);
  });

  test("libera inmediatamente la conexion cuando otra instancia tiene el lock", async () => {
    const connection = { query: jest.fn().mockResolvedValue({ rows: [{ locked: false }] }) };
    jest.spyOn(sequelize.connectionManager, "getConnection").mockResolvedValue(connection);
    const releaseConnection = jest.spyOn(sequelize.connectionManager, "releaseConnection").mockResolvedValue();

    await expect(workflowLock.acquire("configuration:7")).resolves.toBeNull();
    expect(releaseConnection).toHaveBeenCalledWith(connection);
  });
});
