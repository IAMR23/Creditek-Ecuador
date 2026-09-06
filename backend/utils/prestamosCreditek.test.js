const { cuotaPrestamoDelMes, TIPOS_PRESTAMO } = require("./prestamosCreditek");
const prestamo = { seccion: "PRESTAMOS", fecha: "2026-11-20", fechaFin: "2027-02-02", valor: "25.50" };
test.each([[2026, 10, 0], [2026, 11, 25.5], [2026, 12, 25.5], [2027, 1, 25.5], [2027, 2, 25.5], [2027, 3, 0]])("cuota mensual en %s/%s", (anio, mes, expected) => {
  expect(cuotaPrestamoDelMes(prestamo, { anio, mes })).toBe(expected);
});
test("excluye inactivos y anticipos", () => {
  expect(cuotaPrestamoDelMes({ ...prestamo, activo: false }, { anio: 2026, mes: 12 })).toBe(0);
  expect(cuotaPrestamoDelMes({ ...prestamo, seccion: "ANTICIPOS" }, { anio: 2026, mes: 12 })).toBe(0);
});
test("prestamo sin fin continua en meses y anios posteriores", () => {
  expect(cuotaPrestamoDelMes({ ...prestamo, fechaFin: null }, { anio: 2026, mes: 11 })).toBe(25.5);
  expect(cuotaPrestamoDelMes({ ...prestamo, fechaFin: null }, { anio: 2026, mes: 12 })).toBe(25.5);
  expect(cuotaPrestamoDelMes({ ...prestamo, fechaFin: null }, { anio: 2028, mes: 1 })).toBe(25.5);
  expect(cuotaPrestamoDelMes({ ...prestamo, fechaFin: null }, { anio: 2026, mes: 10 })).toBe(0);
  expect(TIPOS_PRESTAMO).toHaveLength(6);
});
