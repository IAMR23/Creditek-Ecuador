const fs = require("fs");
const path = require("path");
const { sequelize } = require("../config/db");

describe("registro y migracion de revisiones pendientes GHL", () => {
  test("el modelo queda registrado al cargar las asociaciones del backend", () => {
    require("./associations");
    const model = require("./GhlRepartoRevisionPendiente");

    expect(sequelize.models.GhlRepartoRevisionPendiente).toBe(model);
    expect(model.getTableName()).toBe("ghl_reparto_revisiones_pendientes");
    expect(Object.keys(model.rawAttributes)).toEqual(expect.arrayContaining([
      "failureCount",
      "retryAfter",
      "lastFailureCode",
    ]));
  });

  test("la migracion es repetible para tabla, restriccion e indice", () => {
    const sql = fs.readFileSync(path.join(
      __dirname,
      "../migrations/202609170001-create-ghl-reparto-revisiones-pendientes.sql",
    ), "utf8");

    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS ghl_reparto_revisiones_pendientes/i);
    expect(sql).toMatch(/IF NOT EXISTS[\s\S]+ghl_reparto_revision_versiones_check/i);
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS "retryAfter"/i);
    expect(sql).toMatch(/ghl_reparto_revision_fallos_check/i);
    expect(sql).toMatch(/CREATE INDEX IF NOT EXISTS ghl_reparto_revision_pendiente_idx/i);
  });
});
