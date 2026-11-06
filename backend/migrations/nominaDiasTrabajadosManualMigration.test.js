const fs = require("fs");
const path = require("path");

describe("migracion de dias trabajados manuales", () => {
  test("agrega una columna anulable limitada entre cero y treinta", () => {
    const sql = fs.readFileSync(
      path.join(__dirname, "202611060002-nomina-dias-trabajados-manual.sql"),
      "utf8",
    );
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS "diasTrabajadosManual" INTEGER');
    expect(sql).toContain('CHECK ("diasTrabajadosManual" IS NULL OR "diasTrabajadosManual" BETWEEN 0 AND 30)');
  });
});
