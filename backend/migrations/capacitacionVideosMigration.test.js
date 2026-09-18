const fs = require("fs");
const path = require("path");

describe("migración de videos de capacitación", () => {
  const sql = fs.readFileSync(
    path.join(__dirname, "202609180003-create-sistemas-capacitacion-videos.sql"),
    "utf8",
  );

  test("crea una tabla idempotente con los campos requeridos", () => {
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS sistemas_capacitacion_videos");
    expect(sql).toContain("titulo VARCHAR(180) NOT NULL");
    expect(sql).toContain("enlace TEXT NOT NULL");
    expect(sql).toContain("descripcion TEXT NOT NULL");
    expect(sql).toContain("activo BOOLEAN NOT NULL DEFAULT TRUE");
    expect(sql).toContain("CHAR_LENGTH(enlace) <= 2048");
    expect(sql).toContain("CHAR_LENGTH(descripcion) <= 5000");
  });

  test("conserva los datos y agrega índices seguros", () => {
    expect(sql).toContain("CREATE INDEX IF NOT EXISTS");
    expect(sql).toContain("IF NOT EXISTS (");
    expect(sql).not.toMatch(/\bDROP\b/i);
    expect(sql).not.toMatch(/\bDELETE\s+FROM\b/i);
  });
});
