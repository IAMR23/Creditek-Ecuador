import test from "node:test";
import assert from "node:assert/strict";
import {
  calcularEgresosNomina,
  cambiarSeleccionNomina,
  moverPrioridadNomina,
  normalizarIdsNomina,
  ordenarFilasNomina,
  seleccionarFilasNomina,
} from "./rolesCreditekNomina.js";

const colaboradores = [
  { usuarioId: 1, nombre: "Gerente", valorRecibir: 900 },
  { usuarioId: 2, nombre: "Ana", valorRecibir: 460.25 },
  { usuarioId: 3, nombre: "Luis", valorRecibir: 520.50 },
  { usuarioId: 4, nombre: "Zoe", valorRecibir: 470 },
];

test("las personas destacadas anteceden al orden habitual sin alterar las filas originales", () => {
  assert.deepEqual(ordenarFilasNomina(colaboradores, [3, "2", 3, 99]).map((row) => row.usuarioId), [3, 2, 1, 4]);
  assert.deepEqual(colaboradores.map((row) => row.usuarioId), [1, 2, 3, 4]);
  assert.deepEqual(ordenarFilasNomina(colaboradores, []), colaboradores);
});

test("mueve prioridades entre personas presentes y conserva las ausentes del período o filtro", () => {
  const prioridades = [3, 99, 2, 4];
  assert.deepEqual(moverPrioridadNomina(prioridades, 2, -1, colaboradores), ["2", "99", "3", "4"]);
  assert.deepEqual(moverPrioridadNomina(prioridades, 3, 1, colaboradores), ["2", "99", "3", "4"]);
  assert.deepEqual(moverPrioridadNomina(prioridades, 3, -1, colaboradores), ["3", "99", "2", "4"]);
  assert.deepEqual(moverPrioridadNomina(prioridades, 4, 1, colaboradores), ["3", "99", "2", "4"]);
});

test("solo las filas marcadas entran en el total, respetando el orden elegido", () => {
  const ordenadas = ordenarFilasNomina(colaboradores, [3, 2]);
  const seleccionadas = seleccionarFilasNomina(ordenadas, [1, "4"]);
  assert.deepEqual(seleccionadas.map((row) => row.usuarioId), [3, 2]);
  assert.equal(seleccionadas.reduce((total, row) => total + row.valorRecibir, 0), 980.75);
  assert.deepEqual(seleccionarFilasNomina(colaboradores, []), colaboradores);
  assert.deepEqual(seleccionarFilasNomina(colaboradores, [1, 2, 3, 4]), []);
});

test("seleccionar bajo una búsqueda conserva el estado de las filas ocultas", () => {
  const visibles = colaboradores.slice(1, 3);
  const excluidos = cambiarSeleccionNomina([1], visibles, false);
  assert.deepEqual(excluidos, ["1", "2", "3"]);
  assert.deepEqual(seleccionarFilasNomina(visibles, excluidos), []);
  const seleccion = cambiarSeleccionNomina(excluidos, [colaboradores[1]], true);
  assert.deepEqual(seleccionarFilasNomina(colaboradores, seleccion).map((row) => row.usuarioId), [2, 4]);
  assert.deepEqual(cambiarSeleccionNomina(seleccion, visibles, true), ["1"]);
});

test("el orden se mantiene al recalcular valores y la selección no depende de la posición", () => {
  const recalculadas = colaboradores.map((row) => ({ ...row, valorRecibir: row.valorRecibir + 10 }));
  const seleccionadas = seleccionarFilasNomina(ordenarFilasNomina(recalculadas, [4, 2]), [1, 3]);
  assert.deepEqual(seleccionadas.map((row) => [row.usuarioId, row.valorRecibir]), [[4, 480], [2, 470.25]]);
});

test("ignora preferencias inválidas y normaliza identificadores duplicados", () => {
  assert.deepEqual(normalizarIdsNomina({ ids: [1] }), []);
  assert.deepEqual(normalizarIdsNomina(null), []);
  assert.deepEqual(normalizarIdsNomina([1, "1", 2, null, {}, false]), ["1", "2"]);
});

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
