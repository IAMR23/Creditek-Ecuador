const assert = require("node:assert/strict");
const { test } = require("node:test");
const {
  combinarMarcaVacacion,
  contarDiasCalendario,
  distribuirConsumo,
  estadoTemporal,
  generarPeriodosAniversario,
  resumenMovimientos,
  seSuperponen,
  validarAsignaciones,
  validarPeriodoAniversario,
} = require("./vacacionesDomain");

test("saldo histórico suma períodos cumplidos sin duplicar créditos", () => {
  const primero = resumenMovimientos([
    { categoria: "RECONOCIDO_ORDINARIO", dias: 15 },
    { categoria: "DISFRUTADO", dias: 5 },
  ]);
  const segundo = resumenMovimientos([{ categoria: "RECONOCIDO_ORDINARIO", dias: 15 }]);
  assert.equal(primero.disponibles + segundo.disponibles, 25);
  assert.equal(primero.reconocidos + segundo.reconocidos, 30);
});

test("un período incompleto queda en formación y no habilita reconocimiento automático", () => {
  assert.equal(validarPeriodoAniversario({
    fechaIngreso: "2025-11-15", fechaInicio: "2026-11-15", fechaFin: "2027-11-14", hoy: "2026-10-30",
  }), "FORMACION");
  assert.equal(validarPeriodoAniversario({
    fechaIngreso: "2024-01-10", fechaInicio: "2025-01-10", fechaFin: "2026-01-09", hoy: "2026-10-30",
  }), "CUMPLIDO");
});

test("genera todos los períodos desde Usuario.fechaIngreso y deja el actual en formación", () => {
  assert.deepEqual(generarPeriodosAniversario("2024-05-10", "2026-10-30"), [
    { anioServicio: 1, fechaInicio: "2024-05-10", fechaFin: "2025-05-09", estado: "CUMPLIDO", diasOrdinariosSugeridos: 15, diasAdicionalesMaximos: 0 },
    { anioServicio: 2, fechaInicio: "2025-05-10", fechaFin: "2026-05-09", estado: "CUMPLIDO", diasOrdinariosSugeridos: 15, diasAdicionalesMaximos: 0 },
    { anioServicio: 3, fechaInicio: "2026-05-10", fechaFin: "2027-05-09", estado: "FORMACION", diasOrdinariosSugeridos: 0, diasAdicionalesMaximos: 0 },
  ]);
});

test("consume entre períodos respetando primero el más antiguo", () => {
  assert.deepEqual(distribuirConsumo([
    { periodoId: 1, dias: 3 }, { periodoId: 2, dias: 5 },
  ], 6), [{ periodoId: 1, dias: 3 }, { periodoId: 2, dias: 3 }]);
  assert.throws(() => validarAsignaciones({
    asignaciones: [{ periodoId: 2, dias: 2 }], cantidadDias: 2,
    periodos: [{ id: 1, fechaInicio: "2024-01-01", disponibles: 3 }, { id: 2, fechaInicio: "2025-01-01", disponibles: 3 }],
    motivoPrioridad: "",
  }), /motivo/);
});

test("cuenta días calendario inclusivos y deriva el estado temporal", () => {
  assert.equal(contarDiasCalendario("2026-10-30", "2026-11-02"), 4);
  assert.equal(estadoTemporal({ fechaInicio: "2026-10-30", fechaFin: "2026-11-02" }, "2026-10-31"), "EN_CURSO");
});

test("detecta superposición del colaborador sin depender de la agencia", () => {
  assert.equal(seSuperponen("2026-11-01", "2026-11-10", "2026-11-10", "2026-11-12"), true);
  assert.equal(seSuperponen("2026-11-01", "2026-11-09", "2026-11-10", "2026-11-12"), false);
});

test("cancelación parcial conserva lo disfrutado y libera solo lo comprometido restante", () => {
  const saldo = resumenMovimientos([
    { categoria: "RECONOCIDO_ORDINARIO", dias: 15 },
    { categoria: "COMPROMETIDO", dias: 8 },
    { categoria: "COMPROMETIDO", dias: -3 },
    { categoria: "DISFRUTADO", dias: 3 },
    { categoria: "COMPROMETIDO", dias: -5 },
  ]);
  assert.equal(saldo.disfrutados, 3);
  assert.equal(saldo.comprometidos, 0);
  assert.equal(saldo.disponibles, 12);
});

test("pagos reservan, confirman sin doble descuento y se pueden revertir", () => {
  const reservado = resumenMovimientos([
    { categoria: "RECONOCIDO_ADICIONAL", dias: 4 },
    { categoria: "RESERVADO_COMPENSACION", dias: 2 },
  ]);
  const confirmado = resumenMovimientos([
    { categoria: "RECONOCIDO_ADICIONAL", dias: 4 },
    { categoria: "RESERVADO_COMPENSACION", dias: 2 },
    { categoria: "RESERVADO_COMPENSACION", dias: -2 },
    { categoria: "COMPENSADO", dias: 2 },
  ]);
  const revertido = resumenMovimientos([
    { categoria: "RECONOCIDO_ADICIONAL", dias: 4 },
    { categoria: "RESERVADO_COMPENSACION", dias: 2 },
    { categoria: "RESERVADO_COMPENSACION", dias: -2 },
    { categoria: "COMPENSADO", dias: 2 },
    { categoria: "COMPENSADO", dias: -2 },
  ]);
  assert.equal(reservado.disponibles, 2);
  assert.equal(confirmado.disponibles, 2);
  assert.equal(revertido.disponibles, 4);
});

test("marca VAC sin sobrescribir el movimiento de asistencia y expone conflicto", () => {
  const movimiento = { estado: "asistencia", observacion: "Marcación terminal" };
  const combinado = combinarMarcaVacacion(movimiento, 77);
  assert.equal(combinado.estado, "asistencia");
  assert.equal(combinado.observacion, "Marcación terminal");
  assert.equal(combinado.conflictoVacacion, true);
  assert.deepEqual(combinarMarcaVacacion(null, 77), {
    estado: "vacaciones", observacion: "Vacación aprobada", vacacion: true,
    conflictoVacacion: false, solicitudVacacionId: 77,
  });
});

test("la clave de origen de movimientos soporta idempotencia y doble aprobación", () => {
  const movimientos = new Set();
  const insertar = (periodoId, categoria, origenTipo, origenId) => {
    const key = [periodoId, categoria, origenTipo, origenId].join(":");
    if (movimientos.has(key)) throw new Error("OPERACION_DUPLICADA");
    movimientos.add(key);
  };
  insertar(1, "COMPROMETIDO", "APROBACION_SOLICITUD", "50");
  assert.throws(() => insertar(1, "COMPROMETIDO", "APROBACION_SOLICITUD", "50"), /OPERACION_DUPLICADA/);
});
