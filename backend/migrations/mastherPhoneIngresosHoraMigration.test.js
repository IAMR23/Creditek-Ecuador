const fs = require("fs");
const path = require("path");

describe("migracion de fecha y hora de ingresos Masther Phone", () => {
  const sql = fs.readFileSync(
    path.join(__dirname, "202610090001-add-hora-ingresos-masther-phone.sql"),
    "utf8",
  );

  test("convierte fechas existentes a hora local de Guayaquil de forma incremental", () => {
    expect(sql).toContain("current_data_type = 'date'");
    expect(sql).toContain('ALTER COLUMN "fechaIngreso" TYPE TIMESTAMPTZ');
    expect(sql).toContain("AT TIME ZONE 'America/Guayaquil'");
    expect(sql).toContain("timestamp with time zone");
  });

  test("no elimina movimientos existentes", () => {
    expect(sql).not.toMatch(/\b(?:DROP TABLE|TRUNCATE|DELETE FROM)\b/i);
  });
});
