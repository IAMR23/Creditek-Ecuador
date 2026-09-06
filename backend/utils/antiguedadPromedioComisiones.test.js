const { superaQuinceDiasIngreso, ventaCuentaParaPromedio } = require("./antiguedadPromedioComisiones");

test.each([
  ["2026-08-01", "2026-08-15", false],
  ["2026-08-01", "2026-08-16", false],
  ["2026-08-01", "2026-08-17", true],
  ["2026-07-25", "2026-08-10", true],
  ["2026-08-20", "2026-08-10", false],
  [null, "2026-08-31", false],
  ["2026-02-30", "2026-08-31", false],
])("antiguedad desde %s hasta %s: %s", (ingreso, referencia, esperado) => {
  expect(superaQuinceDiasIngreso(ingreso, referencia)).toBe(esperado);
});

test.each([
  ["2026-08-06", "2026-08-06"],
  ["2026-08-18", "2026-08-18"],
])("incluye ventas iniciales de personal que permanece: %s", (fechaIngreso, fechaVenta) => {
  expect(ventaCuentaParaPromedio({ fechaIngreso, fechaVenta, fechaSalida: null, activo: true, hoy: "2026-09-06" })).toBe(true);
});

test("personal que permanece pero no supera quince dias sigue fuera", () => {
  expect(ventaCuentaParaPromedio({ fechaIngreso: "2026-08-22", fechaVenta: "2026-08-25", activo: true, hoy: "2026-09-06" })).toBe(false);
});

test("con salida conserva evaluacion en fecha de venta", () => {
  const persona = { fechaIngreso: "2026-08-01", fechaSalida: "2026-08-30", activo: false, hoy: "2026-09-06" };
  expect(ventaCuentaParaPromedio({ ...persona, fechaVenta: "2026-08-10" })).toBe(false);
  expect(ventaCuentaParaPromedio({ ...persona, fechaVenta: "2026-08-20" })).toBe(true);
});

test("inactivo sin salida no recibe la excepcion de permanencia", () => {
  expect(ventaCuentaParaPromedio({ fechaIngreso: "2026-08-01", fechaVenta: "2026-08-10", activo: false, hoy: "2026-09-06" })).toBe(false);
});
