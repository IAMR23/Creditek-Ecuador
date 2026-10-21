const { calcularPlanPrestamo, cuotaPrestamoDelMes, fechaFinPlanPrestamo, TIPOS_PRESTAMO } = require("./prestamosCreditek");
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
test("distribuye el monto total en el plazo y conserva exactamente los centavos", () => {
  const plan = calcularPlanPrestamo({ fecha: "2026-11-20", montoTotal: "100.00", plazoMeses: 3, prorrogas: [] });
  expect(plan).toEqual([
    { periodo: "2026-11", valor: 33.33, estado: "RECURRENTE", numeroCuota: 1, plazoMeses: 3 },
    { periodo: "2026-12", valor: 33.33, estado: "RECURRENTE", numeroCuota: 2, plazoMeses: 3 },
    { periodo: "2027-01", valor: 33.34, estado: "RECURRENTE", numeroCuota: 3, plazoMeses: 3 },
  ]);
  expect(plan.reduce((total, cuota) => total + cuota.valor, 0)).toBeCloseTo(100, 2);
});
test("una prorroga deja el mes sin descuento y desplaza el saldo al mes siguiente", () => {
  const row = { seccion: "PRESTAMOS", fecha: "2026-11-20", montoTotal: 100, plazoMeses: 3, prorrogas: ["2026-12"] };
  expect(calcularPlanPrestamo(row)).toEqual([
    { periodo: "2026-11", valor: 33.33, estado: "RECURRENTE", numeroCuota: 1, plazoMeses: 3 },
    { periodo: "2026-12", valor: 0, estado: "PRORROGA", prorroga: true },
    { periodo: "2027-01", valor: 33.33, estado: "RECURRENTE", numeroCuota: 2, plazoMeses: 3 },
    { periodo: "2027-02", valor: 33.34, estado: "RECURRENTE", numeroCuota: 3, plazoMeses: 3 },
  ]);
  expect(cuotaPrestamoDelMes(row, { anio: 2026, mes: 12 })).toBe(0);
  expect(cuotaPrestamoDelMes(row, { anio: 2027, mes: 2 })).toBe(33.34);
  expect(fechaFinPlanPrestamo(row)).toBe("2027-02-28");
});
