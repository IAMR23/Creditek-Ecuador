import test from "node:test";
import assert from "node:assert/strict";
import {
  PERIODO_POWER_BI,
  calcularCantidadSemanasOperativas,
  construirRango13SemanasDesdeFin,
  construirRangoPeriodoPowerBi,
  esRango13SemanasOperativas,
} from "./powerBiPeriodos.js";

const HOY = new Date(2026, 8, 22);

test("el periodo por defecto conserva las 13 semanas jueves a miercoles", () => {
  const rango = construirRango13SemanasDesdeFin(HOY);

  assert.deepEqual(rango, {
    fechaInicio: "2026-06-25",
    fechaFin: "2026-09-23",
  });
  assert.equal(esRango13SemanasOperativas(rango.fechaInicio, rango.fechaFin), true);
  assert.equal(calcularCantidadSemanasOperativas(rango.fechaInicio, rango.fechaFin), 13);
});

test("permite elegir una semana comercial desde cualquier fecha de referencia", () => {
  assert.deepEqual(
    construirRangoPeriodoPowerBi({
      tipo: PERIODO_POWER_BI.SEMANA,
      fechaReferencia: "2026-09-22",
      fechaActual: HOY,
    }),
    { fechaInicio: "2026-09-17", fechaFin: "2026-09-23" },
  );
});

test("construye los ultimos 7 dias incluyendo la fecha actual", () => {
  assert.deepEqual(
    construirRangoPeriodoPowerBi({
      tipo: PERIODO_POWER_BI.ULTIMOS_7_DIAS,
      fechaActual: HOY,
    }),
    { fechaInicio: "2026-09-16", fechaFin: "2026-09-22" },
  );
});

test("construye el mes calendario seleccionado", () => {
  assert.deepEqual(
    construirRangoPeriodoPowerBi({
      tipo: PERIODO_POWER_BI.MES,
      mesReferencia: "2026-02",
      fechaActual: HOY,
    }),
    { fechaInicio: "2026-02-01", fechaFin: "2026-02-28" },
  );
});

test("este anio inicia el primero de enero y termina hoy", () => {
  assert.deepEqual(
    construirRangoPeriodoPowerBi({
      tipo: PERIODO_POWER_BI.ESTE_ANIO,
      fechaActual: HOY,
    }),
    { fechaInicio: "2026-01-01", fechaFin: "2026-09-22" },
  );
});

test("el rango personalizado conserva inicio y fin", () => {
  assert.deepEqual(
    construirRangoPeriodoPowerBi({
      tipo: PERIODO_POWER_BI.PERSONALIZADO,
      fechaInicio: "2026-01-15",
      fechaFin: "2026-03-20",
      fechaActual: HOY,
    }),
    { fechaInicio: "2026-01-15", fechaFin: "2026-03-20" },
  );
});
