const { calcularNominaPeriodo, validarNovedad, diasEnMes30 } = require('./nominaNovedades');
const periodo = { anio: 2026, mes: 8 };
const madre = (extra = {}) => ({ usuarioId: 10, tipo: 'MATERNIDAD', fechaInicio: '2026-08-01', fechaFin: '2026-08-31',
  fechaRetorno: null, porcentajeEmpleador: 25, porcentajeIess: 75, activo: true, ajustesMensuales: {}, ...extra });
const datos = { usuarioId: 10, tipo: 'MATERNIDAD', fechaInicio: '2026-08-01', fechaFin: '2026-08-31', ...periodo };
test('empleado sin novedad: 30 días y sueldo completo con comportamiento previo', () => {
  expect(calcularNominaPeriodo({}, periodo)).toMatchObject({ diasTrabajados: 30, sueldoAPagar: 482, iess: 45.55, valorRecibir: 436.45 });
  expect(calcularNominaPeriodo({ fondoReservaActivo: true, ingresosComisiones: 20 }, periodo)).toMatchObject({ fondosReserva: 40.17, totalIngresos: 542.17, iess: 51.24, valorRecibir: 490.93 });
});
test('maternidad completa: 30 días al 25%, IESS sobre 482', () => {
  expect(calcularNominaPeriodo({}, periodo, [madre()])).toMatchObject({ diasMaternidad25: 30, diasSueldoCompleto: 0, sueldoAPagar: 120.5, subsidioIessInformativo: 361.5, iess: 45.55 });
});
test('ejemplo completo: 15/15, fondos históricos, anticipos y préstamos', () => {
  const resultado = calcularNominaPeriodo({ fondosReservaManual: 40.15, totalAnticipos: 183.50, prestamosEgresos: 50 }, periodo,
    [madre({ fechaRetorno: '2026-08-16' })]);
  expect(resultado).toMatchObject({ sueldoCompletoPeriodo: 241, sueldoMaternidadEmpresa: 60.25, sueldoAPagar: 301.25,
    subsidioIessInformativo: 180.75, fondosReserva: 40.15, totalIngresos: 341.40, iess: 45.55,
    anticipo: 183.50, prestamo: 50, totalEgresos: 279.05, valorRecibir: 62.35 });
});
test('fondos automáticos mantienen la base completa; IESS no usa fondos ni subsidio', () => {
  expect(calcularNominaPeriodo({ fondoReservaActivo: true }, periodo, [madre()])).toMatchObject({ fondosReserva: 40.17, baseIess: 482, iess: 45.55 });
  expect(calcularNominaPeriodo({ fondosReservaManual: 0 }, periodo, [madre()]).fondosReserva).toBe(0);
});
test('lactancia mantiene 30 días y 100% del sueldo; no hereda el 25%', () => {
  expect(calcularNominaPeriodo({}, periodo, [madre({ tipo: 'LACTANCIA', fechaRetorno: '2026-08-16' })])).toMatchObject({ diasTrabajados: 30, sueldoAPagar: 482, diasMaternidad25: 0, subsidioIessInformativo: 0, tipoNovedad: 'LACTANCIA' });
});
test('mes sin novedad conserva exactamente el comportamiento actual', () => {
  const row = { fechaIngreso: '2026-08-15', rolPagoSueldoExtra: 60, fondoReservaActivo: true, ingresosComisiones: 15, totalAnticipos: 10, sumanPrestamos: 5, descuentosMetaCalculado: 3 };
  expect(calcularNominaPeriodo(row, periodo, [madre({ fechaFin: '2026-07-31', fechaInicio: '2026-07-01' })])).toEqual(calcularNominaPeriodo(row, periodo));
  expect(calcularNominaPeriodo(row, periodo).diasTrabajados).toBe(16);
});
test('fechas distribuyen los días en cada mes sin usar ajustes manuales antiguos', () => {
  const novedad = madre({ fechaInicio: '2026-08-16', fechaFin: '2026-09-30', ajustesMensuales: { '2026-08': { diasMaternidad25Manual: 30, diasSueldoCompletoManual: 0 } } });
  expect(calcularNominaPeriodo({}, periodo, [novedad]).sueldoAPagar).toBe(301.25);
  expect(calcularNominaPeriodo({}, { anio: 2026, mes: 9 }, [novedad]).sueldoAPagar).toBe(120.5);
  expect(calcularNominaPeriodo({}, periodo, [madre({ ajustesMensuales: { '2026-08': { diasMaternidad25Manual: 0 } } })]).sueldoAPagar).toBe(120.5);
});
test('un ajuste antiguo no reactiva maternidad después del retorno', () => {
  const novedad = madre({ fechaRetorno: '2026-08-01', ajustesMensuales: { '2026-08': { diasMaternidad25Manual: 30 } } });
  expect(calcularNominaPeriodo({}, periodo, [novedad])).toMatchObject({ diasMaternidad25: 0, sueldoAPagar: 482, tipoNovedad: '' });
});
test('el final de licencia incluye ese día y el retorno cuenta como sueldo completo', () => {
  const porFinal = calcularNominaPeriodo({}, periodo, [madre({ fechaFin: '2026-08-15' })]);
  const porRetorno = calcularNominaPeriodo({}, periodo, [madre({ fechaRetorno: '2026-08-16' })]);
  expect(porFinal).toEqual(porRetorno);
  expect(porFinal).toMatchObject({ diasMaternidad25: 15, diasSueldoCompleto: 15, sueldoAPagar: 301.25 });
});
test('fechas automáticas, retorno y fin de mes laboral de 30 días', () => {
  expect(calcularNominaPeriodo({}, periodo, [madre({ fechaInicio: '2026-08-16' })]).sueldoAPagar).toBe(301.25);
  expect(calcularNominaPeriodo({}, periodo, [madre({ fechaRetorno: '2026-08-16' })]).sueldoAPagar).toBe(301.25);
  expect(diasEnMes30('2026-02-01', '2026-02-28', { anio: 2026, mes: 2 })).toBe(30);
  expect(diasEnMes30('2028-02-01', '2028-02-29', { anio: 2028, mes: 2 })).toBe(30);
  expect(diasEnMes30('2026-08-31', '2026-08-31', periodo)).toBe(0);
});
test.each([
  { diasMaternidad25Manual: 16, diasSueldoCompletoManual: 15 },
  { diasMaternidad25Manual: -1 }, { diasSueldoCompletoManual: 31 }, { diasSueldoCompletoManual: 'abc' },
  { fechaInicio: '2026-02-30' }, { fechaFin: '2026-07-31' }, { fechaRetorno: '2026-07-31' },
  { porcentajeEmpleador: -1 }, { porcentajeIess: 80 }, { tipo: 'OTRO' },
  { tipo: 'LACTANCIA', diasMaternidad25Manual: 15 },
])('rechaza datos inválidos %j', (cambio) => { expect(() => validarNovedad({ ...datos, ...cambio })).toThrow(); });
test('ignora novedades inactivas y mantiene comisiones y egresos', () => {
  expect(calcularNominaPeriodo({}, periodo, [madre({ activo: false })])).toEqual(calcularNominaPeriodo({}, periodo));
  expect(calcularNominaPeriodo({ ingresosComisiones: 100, totalAnticipos: 25, descuentosMeta: 5, descuentosMetaCalculado: 5, sumanPrestamos: 10, prestamosEgresos: 20 }, periodo, [madre()])).toMatchObject({ comisionVenta: 100, anticipo: 20, prestamo: 30, sancionMeta: 5, totalEgresos: 100.55 });
});
