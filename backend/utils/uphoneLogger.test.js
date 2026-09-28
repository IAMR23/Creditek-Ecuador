const uphoneLogger = require("./uphoneLogger");

describe("uphoneLogger", () => {
  test("registra diagnostico de base sin exponer filas, SQL ni parametros", () => {
    const previousEnvironment = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    const caughtError = new Error("null value in column importadoPorId");
    caughtError.name = "SequelizeDatabaseError";
    caughtError.original = {
      code: "23502",
      table: "uphone_solicitudes",
      column: "importadoPorId",
      constraint: "uphone_importado_por_not_null",
      detail: "La fila contiene cedula y telefono privados",
      sql: "INSERT INTO uphone_solicitudes ...",
      parameters: ["dato privado"],
    };

    try {
      uphoneLogger.error("importacion fallida", caughtError, {
        requestId: "request-test",
        stage: "insertar_postgresql",
      });

      expect(consoleSpy).toHaveBeenCalledTimes(1);
      const [event, details] = consoleSpy.mock.calls[0];
      expect(event).toBe("[UPHONE] importacion fallida");
      expect(details).toMatchObject({
        requestId: "request-test",
        stage: "insertar_postgresql",
        errorName: "SequelizeDatabaseError",
        sqlState: "23502",
        table: "uphone_solicitudes",
        column: "importadoPorId",
      });
      expect(JSON.stringify(details)).not.toMatch(/cedula|telefono|INSERT INTO|dato privado/i);
      expect(details.stack).toBeUndefined();
    } finally {
      consoleSpy.mockRestore();
      if (previousEnvironment === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = previousEnvironment;
    }
  });
});
