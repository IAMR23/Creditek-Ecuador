const fs = require("fs");
const path = require("path");

describe("migracion de relaciones entre cargos y juniors", () => {
  test("crea llaves foraneas, unicidad y evita autorrelaciones", () => {
    const sql = fs.readFileSync(
      path.join(__dirname, "202611060003-create-roles-pago-juniors.sql"),
      "utf8",
    );
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS roles_pago_juniors");
    expect(sql).toContain('REFERENCES roles_pago(id)');
    expect(sql).toContain('CHECK ("cargoRolPagoId" <> "juniorRolPagoId")');
    expect(sql).toContain("roles_pago_juniors_cargo_junior_unique");
  });
});
