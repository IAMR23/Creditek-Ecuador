jest.mock("../models/EgresoCreditekTipo", () => ({ create: jest.fn(), findOne: jest.fn(), findAll: jest.fn() }));
const Tipo = require("../models/EgresoCreditekTipo");
const { crear, actualizar, validarTipo, listar } = require("./egresosCreditekTiposService");

beforeEach(() => jest.resetAllMocks());
test("crea tipos independientes por seccion, normaliza nombre y registra autor", async () => {
  Tipo.create.mockImplementation(async (row) => row);
  const row = await crear("prestamos", { nombre: "  Crédito   educativo " }, 7);
  expect(row).toMatchObject({ seccion: "PRESTAMOS", nombre: "Crédito educativo", nombreClave: "credito educativo", actualizadoPorId: 7 });
  expect(row.codigo).toMatch(/^T_[A-F0-9]{28}$/);
});
test.each([null, "", " ", "a".repeat(101)])("rechaza nombre invalido", async (nombre) => {
  await expect(crear("anticipos", { nombre }, 7)).rejects.toMatchObject({ statusCode: 400 });
  expect(Tipo.create).not.toHaveBeenCalled();
});
test("evita duplicados normalizados en la misma seccion", async () => {
  Tipo.create.mockRejectedValue({ name: "SequelizeUniqueConstraintError" });
  await expect(crear("anticipos", { nombre: "Nuevo" }, 7)).rejects.toMatchObject({ statusCode: 409 });
});
test("renombra conservando codigo, seccion e historial", async () => {
  const row = { update: jest.fn(async (changes) => changes) };
  Tipo.findOne.mockResolvedValue(row);
  await actualizar("prestamos", 4, { nombre: "Nuevo nombre", codigo: "CAMBIADO", seccion: "ANTICIPOS" }, 7);
  expect(row.update).toHaveBeenCalledWith({ nombre: "Nuevo nombre", nombreClave: "nuevo nombre", actualizadoPorId: 7 });
  expect(Tipo.findOne).toHaveBeenCalledWith({ where: { id: 4, seccion: "PRESTAMOS" } });
});
test("desactiva y reactiva sin borrar registros", async () => {
  const row = { update: jest.fn(async (changes) => changes) };
  Tipo.findOne.mockResolvedValue(row);
  await actualizar("anticipos", 4, { activo: false }, 7);
  await actualizar("anticipos", 4, { activo: true }, 7);
  expect(row.update).toHaveBeenNthCalledWith(1, { activo: false, actualizadoPorId: 7 });
  expect(row.update).toHaveBeenNthCalledWith(2, { activo: true, actualizadoPorId: 7 });
});
test("rechaza tipos de otra seccion", async () => {
  Tipo.findOne.mockResolvedValue(null);
  await expect(actualizar("prestamos", 4, { activo: false }, 7)).rejects.toMatchObject({ statusCode: 404 });
  await expect(validarTipo("prestamos", "CODIGO_ANTICIPO")).rejects.toMatchObject({ statusCode: 400 });
});
test("un tipo inactivo no permite nuevos usos pero conserva la edicion historica", async () => {
  Tipo.findOne.mockResolvedValue({ activo: false });
  await expect(validarTipo("prestamos", "MECANICA")).rejects.toMatchObject({ statusCode: 400 });
  await expect(validarTipo("prestamos", "MECANICA", "MECANICA")).resolves.toBe("MECANICA");
});
test("lista activos e inactivos de una sola seccion", async () => {
  await listar("anticipos");
  expect(Tipo.findAll).toHaveBeenCalledWith(expect.objectContaining({ where: { seccion: "ANTICIPOS" } }));
});
