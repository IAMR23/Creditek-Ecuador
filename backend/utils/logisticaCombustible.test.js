const {
  validarRegistro,
  validarFecha,
  validarDecimal,
} = require("./logisticaCombustible");

const valido = {
  fecha: "2026-10-06",
  vehiculo: "MOTO ROJA",
  kilometrajeInicial: 120.1,
  kilometrajeFinal: 123.3,
  costoCombustible: 5,
  observacion: " Entrega ",
};

describe("validación de kilometraje y combustible", () => {
  test("calcula distancia exacta e ignora campos calculados enviados por el cliente", () => {
    expect(
      validarRegistro({ ...valido, kilometrosRecorridos: 500, id: 7 }),
    ).toEqual({
      ...valido,
      kilometrosRecorridos: 3.2,
      observacion: "Entrega",
    });
  });
  test("permite kilometraje igual y gasto en cero", () => {
    expect(
      validarRegistro({
        ...valido,
        kilometrajeFinal: 120.1,
        costoCombustible: 0,
      }).kilometrosRecorridos,
    ).toBe(0);
  });
  test.each([
    null,
    undefined,
    "",
    -1,
    "-1",
    true,
    [],
    {},
    "Infinity",
    NaN,
    "1e3",
    "1.001",
    100000000,
  ])("rechaza decimal inválido %p", (valor) => {
    expect(() => validarDecimal(valor, "Gasto")).toThrow();
  });
  test.each([
    "",
    "2026-02-29",
    "2026-02-30",
    "2026-13-01",
    "06/10/2026",
    "2026-10-06T00:00:00Z",
    null,
  ])("rechaza fecha inválida %p", (fecha) => {
    expect(() => validarFecha(fecha)).toThrow();
  });
  test("acepta fecha bisiesta válida", () =>
    expect(validarFecha("2024-02-29")).toBe("2024-02-29"));
  test("rechaza odómetro decreciente", () =>
    expect(() => validarRegistro({ ...valido, kilometrajeFinal: 100 })).toThrow(
      "mayor o igual",
    ));
  test("permite gasto sin solicitar consumo de combustible", () => {
    const registro = validarRegistro(valido);
    expect(registro.costoCombustible).toBe(5);
    expect(registro).not.toHaveProperty("combustibleConsumido");
    expect(validarRegistro({ ...valido, combustibleConsumido: 0 })).toEqual(
      registro,
    );
  });
  test.each([
    undefined,
    null,
    "",
    "  ",
    {},
    "MOTO VERDE",
    "moto roja",
    "Moto\n123",
  ])("rechaza vehículo inválido %p", (vehiculo) => {
    expect(() => validarRegistro({ ...valido, vehiculo })).toThrow("vehículo");
  });
  test.each(["MOTO ROJA", "FURGONETA", "CARRO HAVAL", "MOTO AZUL"])(
    "acepta el vehículo de catálogo %s",
    (vehiculo) => {
      expect(validarRegistro({ ...valido, vehiculo }).vehiculo).toBe(vehiculo);
    },
  );
  test("limita observaciones y rechaza estructuras", () => {
    expect(() =>
      validarRegistro({ ...valido, observacion: "x".repeat(2001) }),
    ).toThrow("2000");
    expect(() => validarRegistro({ ...valido, observacion: {} })).toThrow(
      "texto",
    );
  });
});
