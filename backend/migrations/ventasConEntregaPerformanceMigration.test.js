const fs = require("fs");
const path = require("path");

describe("migracion de rendimiento de ventas con entrega", () => {
  const sql = fs.readFileSync(
    path.join(__dirname, "202609180001-optimize-ventas-con-entrega.sql"),
    "utf8",
  );

  test("agrega valores normalizados sin alterar columnas originales", () => {
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS contrato_normalizado");
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS imei_normalizado");
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS fecha_normalizada");
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS referencia_pdf_normalizada");
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS cedula_normalizada");
    expect(sql).not.toMatch(/\bDELETE\s+FROM\b/i);
    expect(sql).not.toMatch(/\bDROP\b/i);
  });

  test("hace backfill e instala triggers idempotentes para nuevas escrituras", () => {
    expect(sql).toContain("UPDATE control_financiero_registros");
    expect(sql).toContain("UPDATE detalle_ventas");
    expect(sql).toContain("UPDATE clientes");
    expect(sql).toContain("control_financiero_normalizar_biu");
    expect(sql).toContain("detalle_venta_normalizar_biu");
    expect(sql).toContain("cliente_cedula_normalizar_biu");
    expect(sql).toContain("IF NOT EXISTS");
  });

  test("admite los cuatro formatos historicos de fecha", () => {
    expect(sql).toContain("MM/DD/YY HH12:MI:SS AM");
    expect(sql).toContain("MM/DD/YY HH12:MI AM");
    expect(sql).toContain("MM/DD/YYYY HH12:MI:SS AM");
    expect(sql).toContain("MM/DD/YYYY HH12:MI AM");
  });

  test("crea solo indices concurrentes para las relaciones consultadas", () => {
    expect(sql).toContain("CREATE INDEX CONCURRENTLY IF NOT EXISTS");
    expect(sql).toContain("control_financiero_registros_imei_normalizado_idx");
    expect(sql).toContain("control_financiero_registros_contrato_normalizado_idx");
    expect(sql).toContain("detalle_ventas_venta_id_idx");
    expect(sql).toContain("clientes_cedula_normalizada_reporte_idx");
    expect(sql).toContain("entregas_venta_id_idx");
  });
});
