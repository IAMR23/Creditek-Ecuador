const fs = require("fs");
const path = require("path");

describe("migracion de valores de ingresos Masther Phone", () => {
  const sql = fs.readFileSync(
    path.join(__dirname, "202610080006-add-valores-ingresos-masther-phone.sql"),
    "utf8",
  );

  test("agrega precio, subtotal, IVA y total con consistencia matematica", () => {
    expect(sql).toContain('"precioUnitario" NUMERIC(12, 2)');
    expect(sql).toContain("subtotal NUMERIC(14, 2)");
    expect(sql).toContain("iva = ROUND(subtotal * 0.15, 2)");
    expect(sql).toContain("total = subtotal + iva");
  });

  test("conserva los ingresos anteriores sin inventarles un precio", () => {
    expect(sql).not.toMatch(/UPDATE\s+logistica_masther_phone_ingresos/i);
    expect(sql).not.toMatch(/\b(?:DROP TABLE|TRUNCATE|DELETE FROM)\b/i);
  });
});
