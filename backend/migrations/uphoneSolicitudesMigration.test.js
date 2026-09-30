const fs = require("fs");
const path = require("path");

describe("migracion de solicitudes Uphone", () => {
  const sql = fs.readFileSync(
    path.join(__dirname, "202609280004-create-uphone-solicitudes.sql"),
    "utf8",
  );

  test("crea la tabla con auditoria de origen", () => {
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS uphone_solicitudes");
    expect(sql).toContain('"archivoOrigen" VARCHAR(255) NOT NULL');
    expect(sql).toContain('"importadoPorId" INTEGER NOT NULL REFERENCES usuarios(id)');
  });

  test("protege numeroSolicitud con un indice unico", () => {
    expect(sql).toMatch(
      /CREATE UNIQUE INDEX IF NOT EXISTS uphone_solicitudes_numero_solicitud_unique[\s\S]+\("numeroSolicitud"\)/,
    );
  });

  test("no contiene operaciones destructivas", () => {
    expect(sql).not.toMatch(/DROP\s+(TABLE|COLUMN)/i);
    expect(sql).not.toMatch(/DELETE\s+FROM/i);
  });
});

describe("migracion para cargas Uphone mediante API key", () => {
  const sql = fs.readFileSync(
    path.join(__dirname, "202609280005-allow-uphone-api-key-imports.sql"),
    "utf8",
  );

  test("permite auditoria sin usuario para la computadora integradora", () => {
    expect(sql).toContain('ALTER COLUMN "importadoPorId" DROP NOT NULL');
  });

  test("no elimina filas ni tablas", () => {
    expect(sql).not.toMatch(/DROP\s+(TABLE|COLUMN)/i);
    expect(sql).not.toMatch(/DELETE\s+FROM/i);
  });
});

describe("migracion de unicidad por cedula Uphone", () => {
  const sql = fs.readFileSync(
    path.join(__dirname, "202609290002-add-uphone-cedula-unique.sql"),
    "utf8",
  );

  test("normaliza cedulas y crea una proteccion unica", () => {
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS "cedulaNormalizada"');
    expect(sql).toContain("REGEXP_REPLACE");
    expect(sql).toContain("uphone_solicitudes_cedula_normalizada_unique");
  });

  test("conserva las filas historicas", () => {
    expect(sql).not.toMatch(/DROP\s+(TABLE|COLUMN)/i);
    expect(sql).not.toMatch(/DELETE\s+FROM/i);
  });
});

describe("migracion de unicidad diaria por cedula Uphone", () => {
  const sql = fs.readFileSync(
    path.join(__dirname, "202609300001-uphone-cedula-unique-por-dia.sql"),
    "utf8",
  );

  test("permite la misma cedula en fechas distintas", () => {
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS "fechaSolicitudDia" DATE');
    expect(sql).toContain("PARTITION BY cedula_normalizada, fecha_solicitud_dia");
    expect(sql).toContain("uphone_solicitudes_cedula_fecha_unique");
    expect(sql).toContain('("cedulaNormalizada", "fechaSolicitudDia")');
  });

  test("conserva las solicitudes existentes", () => {
    expect(sql).not.toMatch(/DROP\s+(TABLE|COLUMN)/i);
    expect(sql).not.toMatch(/DELETE\s+FROM/i);
  });
});
