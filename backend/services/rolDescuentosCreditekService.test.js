jest.mock("../models/RolDescuentoCreditek", () => ({ findAll: jest.fn(), create: jest.fn(), update: jest.fn() }));
jest.mock("../models/Usuario", () => ({ findAll: jest.fn(), findOne: jest.fn(), findByPk: jest.fn() }));
const Model = require("../models/RolDescuentoCreditek");
const Usuario = require("../models/Usuario");
const service = require("./rolDescuentosCreditekService");
const payload = () => ({ usuarioId: 7, motivo: " Lentes ", cuotas: [
  { periodo: "2027-01", valor: "10,50", estado: "PENDIENTE" },
  { periodo: "2026-12", valor: "20.25", estado: "APLICADO" },
] });
beforeEach(() => jest.clearAllMocks());

test("normaliza importes y ordena las cuotas al cambiar de año", () => {
  expect(service.normalizarRegistro(payload())).toEqual({ usuarioId: 7, motivo: "Lentes", cuotas: [
    { periodo: "2026-12", valor: 20.25, estado: "APLICADO" },
    { periodo: "2027-01", valor: 10.5, estado: "PENDIENTE" },
  ] });
});
test.each(["2026-00", "2026-13", "26-01", "1999-12", "2101-01", null])("rechaza período inválido %s", (periodo) => {
  const body = payload(); body.cuotas[0].periodo = periodo;
  expect(() => service.normalizarRegistro(body)).toThrow();
});
test.each([0, -1, "", "1.234", "NaN", "Infinity", "1e2", "10000000000", true])("rechaza importe inválido %s", (valor) => {
  const body = payload(); body.cuotas[0].valor = valor;
  expect(() => service.normalizarRegistro(body)).toThrow();
});
test("rechaza motivo vacío, meses repetidos y estados no reconocidos", () => {
  expect(() => service.normalizarRegistro({ ...payload(), motivo: " " })).toThrow();
  expect(() => service.normalizarRegistro({ ...payload(), cuotas: [] })).toThrow();
  const body = payload(); body.cuotas.push(body.cuotas[0]);
  expect(() => service.normalizarRegistro(body)).toThrow(/repita/);
  expect(() => service.normalizarRegistro({ ...payload(), cuotas: [{ periodo: "2026-01", valor: 2, estado: "PAGADO" }] })).toThrow(/estado/);
});
test("consulta el rango conservando cuotas fuera de la vista para editar sin pérdida", async () => {
  const registro = { id: 1, ...payload() };
  Model.findAll.mockResolvedValue([registro, { id: 2, cuotas: [{ periodo: "2025-01" }] }]);
  Usuario.findAll.mockResolvedValue([{ id: 7, nombre: "Ana" }]);
  const resultado = await service.obtener({ inicio: "2026-03", fin: "2026-12" });
  expect(resultado.registros).toEqual([registro]);
  expect(resultado.registros[0].cuotas).toHaveLength(2);
  expect(Model.findAll).toHaveBeenCalledWith(expect.objectContaining({ where: { activo: true } }));
});
test("permite consultar archivados y valida límites del rango", async () => {
  Model.findAll.mockResolvedValue([]); Usuario.findAll.mockResolvedValue([]);
  await service.obtener({ inicio: "2026-01", fin: "2027-12", archivados: "true" });
  expect(Model.findAll).toHaveBeenCalledWith(expect.objectContaining({ where: { activo: false } }));
  await expect(service.obtener({ inicio: "2026-01", fin: "2028-01" })).rejects.toMatchObject({ statusCode: 400 });
  await expect(service.obtener({ inicio: "2026-12", fin: "2026-01" })).rejects.toMatchObject({ statusCode: 400 });
});
test("solo crea para usuarios activos y registra al autor autenticado", async () => {
  Usuario.findOne.mockResolvedValue(null);
  await expect(service.crear(payload(), 9)).rejects.toThrow(/activo/);
  expect(Model.create).not.toHaveBeenCalled();
  Usuario.findOne.mockResolvedValue({ id: 7 });
  await service.crear({ ...payload(), registradoPorId: 123 }, 9);
  expect(Model.create).toHaveBeenCalledWith(expect.objectContaining({ registradoPorId: 9, actualizadoPorId: 9 }));
});
test("edita cuotas históricas con control de versión y detecta cambios concurrentes", async () => {
  Usuario.findByPk.mockResolvedValue({ id: 7, activo: false });
  Model.update.mockResolvedValue([1]);
  await service.actualizar(3, { ...payload(), version: 2 }, 9);
  expect(Model.update).toHaveBeenCalledWith(expect.objectContaining({ version: 3, actualizadoPorId: 9 }), { where: { id: 3, version: 2 } });
  Model.update.mockResolvedValue([0]);
  await expect(service.actualizar(3, { ...payload(), version: 2 }, 9)).rejects.toMatchObject({ statusCode: 409 });
});
test("archiva y restaura sin borrar cuotas ni aceptar campos adicionales", async () => {
  Model.update.mockResolvedValue([1]);
  await service.actualizar(3, { activo: false, version: 1, cuotas: [] }, 9, true);
  expect(Model.update).toHaveBeenLastCalledWith({ activo: false, version: 2, actualizadoPorId: 9 }, { where: { id: 3, version: 1 } });
  await service.actualizar(3, { activo: true, version: 2 }, 9, true);
  expect(Model.update).toHaveBeenLastCalledWith({ activo: true, version: 3, actualizadoPorId: 9 }, { where: { id: 3, version: 2 } });
  await expect(service.actualizar(3, { activo: "false", version: 3 }, 9, true)).rejects.toThrow();
});
