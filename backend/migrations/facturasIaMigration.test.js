const fs = require("fs");
const path = require("path");

describe("migracion Facturas IA", () => {
  test("crea persistencia JSONB e indices sin operaciones destructivas", () => {
    const sql = fs.readFileSync(
      path.join(__dirname, "202608190004-create-facturas-ia-resultados.sql"),
      "utf8",
    );
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS facturas_ia_resultados/i);
    expect(sql).toMatch(/"payloadOriginal" JSONB NOT NULL/i);
    expect(sql).toMatch(/"payloadNormalizado" JSONB NOT NULL/i);
    expect(sql).toMatch(/CREATE INDEX IF NOT EXISTS facturas_ia_grupo_idx/i);
    expect(sql).not.toMatch(/(?:^|\n)\s*(?:DROP|TRUNCATE|DELETE)\b/im);
  });
});
