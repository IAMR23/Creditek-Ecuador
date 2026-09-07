jest.mock('../config/db', () => ({ sequelize: { transaction: jest.fn(async (fn) => fn({ LOCK: { UPDATE: 'UPDATE' } })) } }));
jest.mock('../models/Usuario', () => ({ findByPk: jest.fn() }));
jest.mock('../models/NominaNovedad', () => ({ findAll: jest.fn(), findByPk: jest.fn(), create: jest.fn() }));
jest.mock('./rolesCreditekResumenService', () => ({ obtenerResumen: jest.fn(), normalizarValor: jest.fn() }));
const Usuario = require('../models/Usuario');
const Modelo = require('../models/NominaNovedad');
const service = require('./nominaNovedadesService');
const resumen = require('./rolesCreditekResumenService');
const payload = { usuarioId: 10, tipo: 'MATERNIDAD', anio: 2026, mes: 8,
  fechaInicio: '2026-08-16', fechaFin: '2026-09-30' };
beforeEach(() => { jest.clearAllMocks(); Usuario.findByPk.mockResolvedValue({ id: 10 }); Modelo.findAll.mockResolvedValue([]); Modelo.findByPk.mockResolvedValue(null); Modelo.create.mockImplementation(async (row) => ({ id: 1, ...row })); });
test('guarda una novedad genérica con auditoría y fechas sin días manuales', async () => {
  const result = await service.guardar(payload, 7);
  expect(result).toMatchObject({ usuarioId: 10, creadoPorId: 7, actualizadoPorId: 7, porcentajeEmpleador: 25, porcentajeIess: 75,
    ajustesMensuales: {} });
  expect(Usuario.findByPk).toHaveBeenCalledWith(10, expect.objectContaining({ lock: 'UPDATE' }));
});
test('rechaza maternidad superpuesta sin escribir', async () => {
  Modelo.findAll.mockResolvedValue([{ id: 2, usuarioId: 10, tipo: 'MATERNIDAD', activo: true, fechaInicio: '2026-07-15', fechaFin: '2026-08-16' }]);
  await expect(service.guardar(payload, 7)).rejects.toThrow(/superpuesta/);
  expect(Modelo.create).not.toHaveBeenCalled();
});
test('permite lactancia y maternidad consecutivas', async () => {
  Modelo.findAll.mockResolvedValue([{ id: 2, usuarioId: 10, tipo: 'MATERNIDAD', activo: true, fechaInicio: '2026-07-01', fechaFin: '2026-07-31' }]);
  await expect(service.guardar({ ...payload, tipo: 'LACTANCIA' }, 7)).resolves.toMatchObject({ tipo: 'LACTANCIA' });
});
test('al corregir fechas conserva el historial antiguo pero no agrega ajustes de días', async () => {
  const actual = { id: 1, ...payload, ajustesMensuales: { '2026-08': { diasMaternidad25Manual: 15, diasSueldoCompletoManual: 15 } }, update: jest.fn(async (row) => row) };
  Modelo.findByPk.mockResolvedValue(actual);
  const result = await service.guardar({ ...payload, mes: 9, fechaFin: '2026-09-20' }, 8, 1);
  expect(result.ajustesMensuales).toEqual({ '2026-08': { diasMaternidad25Manual: 15, diasSueldoCompletoManual: 15 } });
  expect(result.fechaFin).toBe('2026-09-20');
  expect(result.actualizadoPorId).toBe(8);
});
test('rechaza nuevos días manuales aunque provengan de un formulario antiguo', async () => {
  await expect(service.guardar({ ...payload, diasMaternidad25Manual: 0 }, 7)).rejects.toThrow(/automáticamente por fechas/);
  expect(Modelo.create).not.toHaveBeenCalled();
});
test('rechaza empleado ajeno al registro y usuario inexistente', async () => {
  Modelo.findByPk.mockResolvedValue({ id: 1, usuarioId: 11, tipo: 'MATERNIDAD' });
  await expect(service.guardar(payload, 7, 1)).rejects.toThrow(/empleado/);
  Usuario.findByPk.mockResolvedValue(null);
  await expect(service.guardar(payload, 7)).rejects.toMatchObject({ statusCode: 404 });
});
test('sin migración no interrumpe nóminas existentes y bloquea las altas', async () => {
  Modelo.findAll.mockRejectedValue({ original: { code: '42P01' } });
  await expect(service.listarPeriodo(payload)).resolves.toEqual({ disponible: false, registros: [] });
  await expect(service.guardar(payload, 7)).rejects.toMatchObject({ statusCode: 503 });
});
test('vista previa usa importes del servidor y no guarda registros', async () => {
  resumen.obtenerResumen.mockResolvedValue({ registros: [{ usuarioId: 10, fondosReservaManual: 40.15, totalAnticipos: 183.5, prestamosEgresos: 50 }] });
  const result = await service.vistaPrevia({ ...payload, fondosReservaManual: 999, totalAnticipos: 0, sueldoMensual: 9000 });
  expect(result.calculo).toMatchObject({ sueldoAPagar: 301.25, fondosReserva: 40.15, totalEgresos: 279.05, valorRecibir: 62.35, subsidioIessInformativo: 180.75 });
  expect(Modelo.create).not.toHaveBeenCalled();
});
test('inactivar permite conservar el registro sin aplicar sus días', async () => {
  const update = jest.fn(async (row) => row);
  Modelo.findByPk.mockResolvedValue({ ...payload, id: 1, update });
  expect(await service.guardar({ ...payload, activo: false }, 7, 1)).toMatchObject({ activo: false });
  expect(update).toHaveBeenCalledTimes(1);
});
test('valida ajustes pendientes para la vista previa sin guardarlos con la novedad', async () => {
  resumen.obtenerResumen.mockResolvedValue({ registros: [{ usuarioId: 10, fondosReservaManual: 40.15, totalAnticipos: 183.5, prestamosEgresos: 50 }] });
  resumen.normalizarValor.mockReturnValueOnce(50).mockReturnValueOnce(10);
  const datos = { ...payload, ajustesNomina: { fondosReservaManual: '50', sueldosExtrasManual: '10', totalAnticipos: 0 } };
  const result = await service.vistaPrevia(datos);
  expect(resumen.normalizarValor).toHaveBeenCalledWith('50', 'fondosReservaManual');
  expect(resumen.normalizarValor).toHaveBeenCalledWith('10', 'sueldosExtrasManual');
  expect(result.calculo).toMatchObject({ sueldoAPagar: 301.25, fondosReserva: 50, sueldosExtras: 10, iess: 45.55, valorRecibir: 82.2 });
  expect(Modelo.create).not.toHaveBeenCalled();
  const guardado = await service.guardar(datos, 7);
  expect(guardado.ajustesNomina).toBeUndefined();
});

test('corrige tipo, fechas y observación en el mismo registro con auditoría', async () => {
  const actual = { id: 1, ...payload, activo: true, creadoPorId: 3,
    ajustesMensuales: { '2026-08': { diasMaternidad25Manual: 15 } },
    update: jest.fn(async (row) => ({ ...actual, ...row })) };
  Modelo.findByPk.mockResolvedValue(actual);
  Modelo.findAll.mockResolvedValue([actual]);
  const result = await service.guardar({ ...payload, tipo: 'LACTANCIA', fechaRetorno: '2026-08-20', observacion: 'Tipo corregido' }, 8, 1);
  expect(result).toMatchObject({ id: 1, tipo: 'LACTANCIA', fechaRetorno: '2026-08-20', observacion: 'Tipo corregido', creadoPorId: 3, actualizadoPorId: 8 });
  expect(result.ajustesMensuales).toEqual(actual.ajustesMensuales);
  expect(Modelo.create).not.toHaveBeenCalled();
});

test('vista previa de edición permite cambiar a lactancia y recuperar sueldo completo', async () => {
  Modelo.findAll.mockResolvedValue([{ id: 1, ...payload, activo: true }]);
  resumen.obtenerResumen.mockResolvedValue({ registros: [{ usuarioId: 10 }] });
  const result = await service.vistaPrevia({ ...payload, id: 1, tipo: 'LACTANCIA' });
  expect(result.calculo).toMatchObject({ tipoNovedad: 'LACTANCIA', sueldoAPagar: 482, diasMaternidad25: 0 });
});

test('al cambiar lactancia a maternidad sigue rechazando superposiciones', async () => {
  const actual = { id: 1, ...payload, tipo: 'LACTANCIA', activo: true, update: jest.fn() };
  Modelo.findByPk.mockResolvedValue(actual);
  Modelo.findAll.mockResolvedValue([actual, { ...payload, id: 2, activo: true }]);
  await expect(service.guardar(payload, 8, 1)).rejects.toThrow(/superpuesta/);
  expect(actual.update).not.toHaveBeenCalled();
});
