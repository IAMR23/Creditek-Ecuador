import test from "node:test";
import assert from "node:assert/strict";
import { calcularEgresosNomina } from "./rolesCreditekNomina.js";

test("incluye cuotas de Egresos Creditek y conserva los prestamos manuales", () => {
  assert.deepEqual(calcularEgresosNomina({ sumanPrestamos: 10, prestamosEgresos: 40, totalAnticipos: 20 }, 45.55), {
    anticipo: 20, prestamo: 50, sancionMeta: 0, totalEgresos: 115.55,
  });
});

test("separa la sanción de anticipos sin descontarla dos veces", () => {
  assert.deepEqual(calcularEgresosNomina({ totalAnticipos: 97, descuentosMeta: 7, descuentosMetaCalculado: 7, sumanPrestamos: 30 }, 50), {
    anticipo: 90, prestamo: 30, sancionMeta: 7, totalEgresos: 177,
  });
});

test("usa el descuento de Pagos comisiones aunque el resumen tenga un ajuste manual", () => {
  assert.deepEqual(calcularEgresosNomina({ totalAnticipos: 99, descuentosMeta: 9, descuentosMetaCalculado: 7, sumanPrestamos: 30 }, 50), {
    anticipo: 90, prestamo: 30, sancionMeta: 7, totalEgresos: 177,
  });
});

test("respeta la sanción omitida en Pagos comisiones", () => {
  const result = calcularEgresosNomina({ totalAnticipos: 99, descuentosMeta: 9, descuentosMetaCalculado: 0 }, 50);
  assert.equal(result.sancionMeta, 0);
  assert.equal(result.totalEgresos, 140);
});

test("empleado sin sanciones y cantidades decimales", () => {
  assert.deepEqual(calcularEgresosNomina({}, 45.55), { anticipo: 0, prestamo: 0, sancionMeta: 0, totalEgresos: 45.55 });
  assert.equal(calcularEgresosNomina({ totalAnticipos: "10.35", descuentosMeta: "0.25", descuentosMetaCalculado: "0.25", sumanPrestamos: "1.10" }, 45.55).totalEgresos, 57);
});
