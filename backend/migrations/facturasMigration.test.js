const fs = require("fs");
const path = require("path");

describe("migracion de facturas", () => {
  test("crea la tabla y sus campos principales de forma segura", () => {
    const sql = fs.readFileSync(
      path.join(__dirname, "202610190001-create-facturas.sql"),
      "utf8",
    );
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS facturas/i);
    expect(sql).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS facturas_numero_factura_unique/i);
    expect(sql).toMatch(/"identificacionProveedor" VARCHAR\(30\) NULL/i);
    expect(sql).toMatch(/proveedor VARCHAR\(255\) NULL/i);
    expect(sql).toMatch(/"numeroFactura" VARCHAR\(100\) NULL/i);
    expect(sql).toMatch(/subtotal DECIMAL\(14, 2\) NULL/i);
    expect(sql).toMatch(/iva DECIMAL\(14, 2\) NULL/i);
    expect(sql).toMatch(/"formaPago" VARCHAR\(120\) NULL/i);
    expect(sql).toMatch(/"fechaFactura" DATE NULL/i);
    expect(sql).toMatch(/total DECIMAL\(14, 2\) NULL/i);
    expect(sql).toMatch(/estado VARCHAR\(80\) NULL/i);
    expect(sql).toMatch(/tipo VARCHAR\(100\) NULL/i);
    expect(sql).toMatch(/"nombreArchivoJson" VARCHAR\(255\) NULL/i);
    expect(sql).toMatch(/"payloadOriginal" JSONB NULL/i);
    expect(sql).not.toMatch(/"cargadoPorId"\s+INTEGER/i);
    expect(sql).not.toMatch(/REFERENCES\s+usuarios/i);
    for (const field of [
      "fechaFactura",
      "identificacionProveedor",
      "numeroFactura",
      "formaPago",
      "enlaceFoto",
      "payloadOriginal",
    ]) {
      expect(sql).toContain(`"${field}"`);
    }
  });

  test("la migracion incremental no elimina duplicados existentes", () => {
    const sql = fs.readFileSync(
      path.join(__dirname, "202610190002-unique-numero-factura.sql"),
      "utf8",
    );
    expect(sql).toMatch(/HAVING COUNT\(\*\) > 1/i);
    expect(sql).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS facturas_numero_factura_unique/i);
    expect(sql).not.toMatch(/\bDELETE\b|\bDROP\b/i);
  });

  test("permite dejar vacio el RUC o cedula en tablas existentes", () => {
    const sql = fs.readFileSync(
      path.join(
        __dirname,
        "202610190003-allow-null-identificacion-facturas.sql",
      ),
      "utf8",
    );
    expect(sql).toMatch(
      /ALTER COLUMN "identificacionProveedor" DROP NOT NULL/i,
    );
    expect(sql).not.toMatch(/\bDELETE\b/i);
  });

  test("permite dejar vacios los campos tolerados en tablas existentes", () => {
    const sql = fs.readFileSync(
      path.join(
        __dirname,
        "202610190004-allow-null-import-fields-facturas.sql",
      ),
      "utf8",
    );
    for (const field of [
      "proveedor",
      "numeroFactura",
      "subtotal",
      "iva",
      "formaPago",
    ]) {
      expect(sql).toMatch(
        new RegExp(`ALTER COLUMN "?${field}"? DROP NOT NULL`, "i"),
      );
    }
    expect(sql).not.toMatch(/\bDELETE\b/i);
  });

  test("permite dejar vacios todos los campos de factura restantes", () => {
    const sql = fs.readFileSync(
      path.join(
        __dirname,
        "202610190005-allow-null-all-fields-facturas.sql",
      ),
      "utf8",
    );
    for (const field of ["fechaFactura", "total", "estado", "tipo"]) {
      expect(sql).toMatch(
        new RegExp(`ALTER COLUMN "?${field}"? DROP NOT NULL`, "i"),
      );
    }
    expect(sql).not.toMatch(/\bDELETE\b/i);
  });

  test("elimina relaciones y permite metadatos vacios en tablas existentes", () => {
    const sql = fs.readFileSync(
      path.join(
        __dirname,
        "202610190006-remove-relations-and-allow-null-metadata-facturas.sql",
      ),
      "utf8",
    );
    expect(sql).toMatch(/constraint_type = 'FOREIGN KEY'/i);
    expect(sql).toMatch(/DROP CONSTRAINT/i);
    for (const field of ["nombreArchivoJson", "payloadOriginal", "cargadoPorId"]) {
      expect(sql).toMatch(
        new RegExp(`ALTER COLUMN "${field}" DROP NOT NULL`, "i"),
      );
    }
    expect(sql).not.toMatch(/\bDELETE\b/i);
  });
});
