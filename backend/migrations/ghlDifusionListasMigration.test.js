const fs = require("fs");
const path = require("path");

describe("migracion de listas inteligentes de difusion GHL", () => {
  const sql = fs.readFileSync(
    path.join(__dirname, "202609280002-create-ghl-difusion-listas.sql"),
    "utf8",
  );

  test("crea almacenamiento compartido con filtros JSONB y auditoria", () => {
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS ghl_difusion_listas");
    expect(sql).toContain("filtros JSONB NOT NULL");
    expect(sql).toContain('"creadoPorId" INTEGER NOT NULL REFERENCES usuarios(id)');
    expect(sql).toContain('"actualizadoPorId" INTEGER NOT NULL REFERENCES usuarios(id)');
  });

  test("evita nombres duplicados sin operaciones destructivas", () => {
    expect(sql).toContain("ghl_difusion_listas_nombre_unique");
    expect(sql).not.toMatch(/DROP\s+(TABLE|COLUMN)/i);
    expect(sql).not.toMatch(/DELETE\s+FROM/i);
  });
});
