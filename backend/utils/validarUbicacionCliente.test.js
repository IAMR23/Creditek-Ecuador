const {
  esUbicacionClienteValida,
} = require("./validarUbicacionCliente");

describe("esUbicacionClienteValida", () => {
  test.each([null, undefined, "", "  "])(
    "mantiene como válido el valor opcional %p",
    (valor) => {
      expect(esUbicacionClienteValida(valor)).toBe(true);
    },
  );

  test.each([
    "Av. Quito 123",
    "Sector Norte",
    "https://maps.google.com/?q=-2.1,-79.9",
  ])("acepta ubicaciones con texto: %s", (valor) => {
    expect(esUbicacionClienteValida(valor)).toBe(true);
  });

  test.each(["123", " 123 456 ", "-2.123, -79.900"])(
    "rechaza ubicaciones formadas únicamente por números: %s",
    (valor) => {
      expect(esUbicacionClienteValida(valor)).toBe(false);
    },
  );
});
