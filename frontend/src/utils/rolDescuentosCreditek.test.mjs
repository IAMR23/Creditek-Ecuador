import test from "node:test";
import assert from "node:assert/strict";
import { agruparDescuentos, colorCuota, crearExcelDescuentos, mesesDesde, totalesDescuentos } from "./rolDescuentosCreditek.js";
const registros = [
  { id: 1, usuarioId: 7, usuario: { nombre: "Ana Ortiz" }, motivo: "Teléfono", cuotas: [{ periodo: "2026-12", valor: 0.1, estado: "APLICADO" }, { periodo: "2027-01", valor: 25, estado: "REVISAR" }] },
  { id: 2, usuarioId: 7, usuario: { nombre: "Ana Ortiz" }, motivo: "Lentes", cuotas: [{ periodo: "2026-12", valor: 0.2, estado: "RECURRENTE" }] },
  { id: 3, usuarioId: 8, usuario: { nombre: "Ana Ortiz" }, motivo: "Préstamo", cuotas: [{ periodo: "2027-01", valor: 40, estado: "PENDIENTE" }] },
];
test("meses consecutivos atraviesan el año y se agrupa por usuario, no por nombre", () => {
  const meses = mesesDesde("2026-12", 2);
  assert.deepEqual(meses.map((mes) => mes.key), ["2026-12", "2027-01"]);
  const grupos = agruparDescuentos(registros);
  assert.equal(grupos.length, 2);
  assert.equal(grupos[0].filas.length, 2);
  assert.deepEqual(totalesDescuentos(grupos, meses), { "2026-12": 0.3, "2027-01": 65 });
  assert.equal(agruparDescuentos(registros, "telefono")[0].filas.length, 1);
});
test("los estados definen el color y diciembre no implica que la cuota esté aplicada", () => {
  assert.equal(colorCuota({ estado: "PENDIENTE" }, 11), "FBBF24");
  assert.equal(colorCuota({ estado: "APLICADO" }, 11), "00B050");
  assert.equal(colorCuota(null, 0), "FFFFFF");
});
test("Excel conserva importes, años, colores, nombres agrupados y totales", async () => {
  const workbook = await crearExcelDescuentos(agruparDescuentos(registros), mesesDesde("2026-12", 2));
  const buffer = await workbook.xlsx.writeBuffer();
  const { default: ExcelJS } = await import("exceljs");
  const restored = new ExcelJS.Workbook();
  await restored.xlsx.load(buffer);
  const sheet = restored.getWorksheet("Rol descuentos Creditek");
  assert.equal(sheet.getCell("A1").value, "ROL DE DESCUENTOS CREDITEK");
  assert.equal(sheet.getCell("C2").value, "DICIEMBRE 2026");
  assert.equal(sheet.getCell("D2").value, "ENERO 2027");
  assert.equal(sheet.getCell("A4").master.address, "A3");
  assert.equal(sheet.getCell("C3").fill.fgColor.argb, "FF00B050");
  assert.equal(sheet.getCell("D3").fill.fgColor.argb, "FFE879F9");
  assert.equal(sheet.getCell("D4").value, null);
  assert.equal(sheet.getCell("C6").value, 0.3);
  assert.equal(sheet.getCell("D6").value, 65);
});
