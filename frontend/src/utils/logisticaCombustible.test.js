import test from "node:test";
import assert from "node:assert/strict";
import {
  compararRepartidores,
  kilometrosCalculados,
  validarFormularioCombustible,
} from "./logisticaCombustible.js";

const form = {
  fecha: "2026-10-06",
  vehiculo: "MOTO ROJA",
  kilometrajeInicial: "100.1",
  kilometrajeFinal: "120.3",
  costoCombustible: "4",
  observacion: " entrega ",
};

test("formulario calcula distancia sin error de punto flotante", () => {
  assert.equal(kilometrosCalculados("100.1", "120.3"), 20.2);
  assert.equal(kilometrosCalculados("", "120"), null);
  assert.equal(validarFormularioCombustible(form).observacion, "entrega");
});
test("formulario rechaza datos inconsistentes antes de enviarlos", () => {
  for (const cambio of [
    { kilometrajeFinal: "90" },
    { costoCombustible: "-1" },
    { vehiculo: "" },
    { vehiculo: "  " },
    { vehiculo: "MOTO VERDE" },
    { vehiculo: "moto roja" },
    { vehiculo: "Moto\n123" },
    { fecha: "2026-02-30" },
    { fecha: "2026-13-01" },
    { fecha: "" },
    { costoCombustible: "1.001" },
  ]) {
    assert.throws(() => validarFormularioCombustible({ ...form, ...cambio }));
  }
});
test("formulario envía el vehículo sin solicitar litros consumidos", () => {
  const resultado = validarFormularioCombustible(form);
  assert.equal(resultado.vehiculo, "MOTO ROJA");
  assert.equal(resultado.costoCombustible, 4);
  assert.equal(Object.hasOwn(resultado, "combustibleConsumido"), false);
});
test("acepta únicamente el catálogo de vehículos", () => {
  for (const vehiculo of [
    "MOTO ROJA",
    "FURGONETA",
    "CARRO HAVAL",
    "MOTO AZUL",
  ]) {
    assert.equal(
      validarFormularioCombustible({ ...form, vehiculo }).vehiculo,
      vehiculo,
    );
  }
});
test("comparación alinea fechas y conserva los ceros de repartidores sin gasto", () => {
  const resultado = compararRepartidores([
    { userId: 1, fecha: "2026-10-05", costoCombustible: 10 },
    { userId: 2, fecha: "2026-10-06", costoCombustible: 20 },
  ]);
  assert.deepEqual(resultado.ids, [2, 1]);
  assert.equal(resultado.datos[0].repartidor_2, 0);
  assert.equal(resultado.datos[1].repartidor_2, 20);
});
test("comparación limita las líneas a los seis mayores gastos", () => {
  const resultado = compararRepartidores(
    Array.from({ length: 8 }, (_, i) => ({
      userId: i + 1,
      fecha: "2026-10-06",
      costoCombustible: i,
    })),
  );
  assert.equal(resultado.ids.length, 6);
  assert.equal(resultado.total, 8);
  assert.deepEqual(resultado.ids, [8, 7, 6, 5, 4, 3]);
});
