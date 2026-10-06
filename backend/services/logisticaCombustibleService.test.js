jest.mock("../config/db", () => ({
  sequelize: {
    transaction: jest.fn(async (_options, callback) => callback("transaction")),
    where: jest.fn((...args) => args),
  },
}));
jest.mock("../models/LogisticaCombustibleRegistro", () => ({
  findOne: jest.fn(),
  findAndCountAll: jest.fn(),
  findAll: jest.fn(),
  create: jest.fn(),
}));
jest.mock("../models/Usuario", () => ({ findAll: jest.fn() }));
jest.mock("../models/Rol", () => ({}));

const { Op } = require("sequelize");
const Registro = require("../models/LogisticaCombustibleRegistro");
const Usuario = require("../models/Usuario");
const servicio = require("./logisticaCombustibleService");
const repartidor = { id: 9, rol: "REPARTIDOR", permisos: ["Administracion"] };
const administrador = { id: 1, rol: "administrador", permisos: ["Logistica"] };
const data = {
  fecha: "2026-10-06",
  vehiculo: "MOTO ROJA",
  kilometrajeInicial: 100,
  kilometrajeFinal: 130,
  costoCombustible: 5,
};

describe("servicio de combustible: propiedad, consultas y reportes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Registro.findAndCountAll.mockResolvedValue({
      rows: [{ id: 3 }],
      count: 45,
    });
    Registro.findAll.mockResolvedValue([
      {
        fecha: "2026-10-05",
        userId: 9,
        kilometrosRecorridos: "30.20",
        costoCombustible: "5.10",
      },
      {
        fecha: "2026-10-06",
        userId: 9,
        kilometrosRecorridos: "25.10",
        costoCombustible: "3.20",
      },
      {
        fecha: "2026-10-06",
        userId: 10,
        kilometrosRecorridos: "40.20",
        costoCombustible: "5.30",
      },
    ]);
  });

  test("asigna siempre al creador y calcula kilómetros", async () => {
    await servicio.crear({
      user: repartidor,
      data: { ...data, kilometrosRecorridos: 10000, createdAt: "otro" },
    });
    expect(Registro.create).toHaveBeenCalledWith({
      ...data,
      userId: 9,
      observacion: "",
      kilometrosRecorridos: 30,
    });
  });
  test("impide crear para otro usuario", async () => {
    await expect(
      servicio.crear({ user: repartidor, data: { ...data, userId: 10 } }),
    ).rejects.toMatchObject({ status: 403 });
    expect(Registro.create).not.toHaveBeenCalled();
  });
  test("el administrador no puede crear ni editar", async () => {
    await expect(
      servicio.crear({ user: administrador, data }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      servicio.actualizar({ user: administrador, id: 3, data }),
    ).rejects.toMatchObject({ status: 403 });
  });
  test.each(["obtener", "actualizar", "eliminar"])(
    "%s aplica propiedad incluso con permiso de Administración",
    async (operacion) => {
      Registro.findOne.mockResolvedValue(null);
      await expect(
        servicio[operacion]({ user: repartidor, id: 3, data }),
      ).rejects.toMatchObject({ status: 404 });
      expect(Registro.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 3, userId: 9 } }),
      );
    },
  );
  test("edita el registro propio sin reasignarlo", async () => {
    const registro = { update: jest.fn() };
    Registro.findOne.mockResolvedValue(registro);
    await servicio.actualizar({ user: repartidor, id: 3, data });
    expect(registro.update).toHaveBeenCalledWith({
      ...data,
      kilometrosRecorridos: 30,
      observacion: "",
    });
    await expect(
      servicio.actualizar({
        user: repartidor,
        id: 3,
        data: { ...data, userId: 10 },
      }),
    ).rejects.toMatchObject({ status: 403 });
  });
  test.each([repartidor, administrador])(
    "permite baja lógica dentro del alcance autorizado",
    async (user) => {
      const registro = { destroy: jest.fn() };
      Registro.findOne.mockResolvedValue(registro);
      await servicio.eliminar({ user, id: 3 });
      expect(registro.destroy).toHaveBeenCalled();
    },
  );
  test("el repartidor lista únicamente su historial", async () => {
    await servicio.listar({ user: repartidor });
    expect(Registro.findAndCountAll).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 9 }, limit: 20 }),
    );
    expect(Registro.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 9 } }),
    );
    await expect(
      servicio.listar({ user: repartidor, query: { userId: 10 } }),
    ).rejects.toMatchObject({ status: 403 });
  });
  test("aplica los mismos filtros a tabla y gráficas y suma todas las páginas", async () => {
    const resultado = await servicio.listar({
      user: administrador,
      query: {
        desde: "2026-10-01",
        hasta: "2026-10-06",
        userId: "9",
        kmMin: "0",
        kmMax: "100",
        pagina: "2",
      },
    });
    const where = {
      userId: 9,
      fecha: { [Op.gte]: "2026-10-01", [Op.lte]: "2026-10-06" },
      kilometrosRecorridos: { [Op.gte]: 0, [Op.lte]: 100 },
    };
    expect(Registro.findAndCountAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where,
        offset: 20,
        transaction: "transaction",
      }),
    );
    expect(Registro.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ where, transaction: "transaction" }),
    );
    expect(resultado.totales).toEqual({
      kilometrosRecorridos: 95.5,
      costoCombustible: 13.6,
    });
    expect(resultado.porFecha[1]).toEqual({
      fecha: "2026-10-06",
      kilometrosRecorridos: 65.3,
      costoCombustible: 8.5,
    });
    expect(resultado.paginacion).toEqual({
      pagina: 2,
      limite: 20,
      total: 45,
      paginas: 3,
    });
  });
  test("devuelve resumen vacío sin NaN", async () => {
    Registro.findAll.mockResolvedValue([]);
    Registro.findAndCountAll.mockResolvedValue({ rows: [], count: 0 });
    const resultado = await servicio.listar({ user: administrador });
    expect(resultado.totales.costoCombustible).toBe(0);
    expect(resultado.porFecha).toEqual([]);
    expect(resultado.paginacion.paginas).toBe(1);
  });
  test.each([
    { desde: "2026-10-06", hasta: "2026-10-01" },
    { kmMin: "50", kmMax: "40" },
    { limite: "101" },
    { pagina: "0" },
    { userId: "1 OR 1=1" },
  ])("rechaza filtros inconsistentes %p", async (query) => {
    await expect(
      servicio.listar({ user: administrador, query }),
    ).rejects.toMatchObject({ status: 400 });
  });
  test.each([
    { id: 2, rol: "vendedor", permisos: ["Logistica", "Administracion"] },
    { id: 1, rol: "admin", permisos: [] },
  ])(
    "deniega acceso sin combinación correcta de rol y permisos",
    async (user) => {
      await expect(servicio.listar({ user })).rejects.toMatchObject({
        status: 403,
      });
    },
  );
  test("solo administrador consulta catálogo sin datos sensibles", async () => {
    await expect(
      servicio.repartidores({ user: repartidor }),
    ).rejects.toMatchObject({ status: 403 });
    await servicio.repartidores({ user: administrador });
    expect(Usuario.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ attributes: ["id", "nombre"] }),
    );
  });
});
