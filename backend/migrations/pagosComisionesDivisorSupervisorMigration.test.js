const fs = require("fs");
const path = require("path");

describe("migracion del divisor mensual del supervisor", () => {
  test("agrega el divisor y conserva la cantidad seleccionada existente", () => {
    const sql = fs.readFileSync(
      path.join(__dirname, "202611060006-add-divisor-promedio-supervisor.sql"),
      "utf8",
    );

    expect(sql).toContain('ADD COLUMN IF NOT EXISTS "divisorPromedio" DECIMAL(10, 2)');
    expect(sql).toContain('jsonb_array_length("vendedorIds")');
    expect(sql).toContain("pagos_comisiones_promedios_supervisor_divisor_check");
  });
});
