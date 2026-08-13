jest.mock("../models/ConsejoEjecutivoPlan", () => ({
  create: jest.fn(),
  findAll: jest.fn(),
  findByPk: jest.fn(),
  update: jest.fn(),
}));
jest.mock("../models/Usuario", () => ({ findAll: jest.fn() }));
jest.mock("../models/Rol", () => ({}));
jest.mock("../models/UsuarioRol", () => ({}));
jest.mock("./consejoEjecutivoSalasService", () => ({
  obtenerSalaAutorizada: jest.fn(),
}));

const ConsejoEjecutivoPlan = require("../models/ConsejoEjecutivoPlan");
const Usuario = require("../models/Usuario");
const salasService = require("./consejoEjecutivoSalasService");
const service = require("./consejoEjecutivoPlanesService");

const usuarioAdmin = (datos = {}) => ({
  get: () => ({
    id: 4,
    nombre: "Admin Matriz",
    email: "admin@creditek.ec",
    rol: { id: 1, nombre: "Admin" },
    roles: [],
    ...datos,
  }),
});

const payload = {
  salaId: 5,
  fecha: "2026-08-13",
  condicion: "normal",
  respuestasFormula: {
    1: [
      {
        id: "item-1",
        descripcion: "Revisar los indicadores",
        estado: "EN_PROGRESO",
        responsableId: 4,
      },
    ],
  },
  detalle: {},
  observaciones: "Seguimiento semanal",
};

const planCompleto = (datos = {}) => ({
  get: () => ({
    id: 19,
    salaId: 5,
    ...payload,
    respuestasFormula: {
      1: [
        {
          id: "item-1",
          descripcion: "Revisar los indicadores",
          estado: "EN_PROGRESO",
          responsableId: 4,
          responsableNombre: "Admin Matriz",
        },
      ],
      2: [],
      3: [],
      4: [],
    },
    detalle: {
      "Actividades urgentes": [],
      "Actividades pendientes": [],
      "Ordenes que debo cumplir": [],
      "Ordenes que deben realizar mis juniors": [],
      "Meta para la semana": [],
      "Objetivos que contribuyen al plan estrategico": [],
    },
    revision: 1,
    creadoPor: { id: 7, nombre: "Gerencia" },
    actualizadoPor: { id: 7, nombre: "Gerencia" },
    createdAt: "2026-08-13T10:00:00.000Z",
    updatedAt: "2026-08-13T10:00:00.000Z",
    ...datos,
  }),
});

describe("servicio de planes del Consejo Ejecutivo", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    salasService.obtenerSalaAutorizada.mockResolvedValue({
      id: 5,
      participantes: [{ id: 4, nombre: "Admin Matriz" }],
    });
  });

  test("guarda responsable Admin validado y su nombre visible", async () => {
    Usuario.findAll.mockResolvedValue([usuarioAdmin()]);
    ConsejoEjecutivoPlan.create.mockResolvedValue({ id: 19 });
    ConsejoEjecutivoPlan.findByPk.mockResolvedValue(planCompleto());

    const resultado = await service.crearPlan({ user: { id: 7 }, data: payload });

    expect(ConsejoEjecutivoPlan.create).toHaveBeenCalledWith(
      expect.objectContaining({
        condicion: "normal",
        salaId: 5,
        revision: 1,
        creadoPorId: 7,
        respuestasFormula: expect.objectContaining({
          1: [
            expect.objectContaining({
              responsableId: 4,
              responsableNombre: "Admin Matriz",
            }),
          ],
        }),
      }),
    );
    expect(resultado.revision).toBe(1);
  });

  test("rechaza responsables que no tienen rol Admin", async () => {
    Usuario.findAll.mockResolvedValue([
      usuarioAdmin({ rol: { id: 2, nombre: "Vendedor" } }),
    ]);

    await expect(
      service.crearPlan({ user: { id: 7 }, data: payload }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringMatching(/rol Admin/i),
    });
    expect(ConsejoEjecutivoPlan.create).not.toHaveBeenCalled();
  });

  test("rechaza un responsable Admin que no fue invitado a la sala", async () => {
    salasService.obtenerSalaAutorizada.mockResolvedValue({
      id: 5,
      participantes: [{ id: 6, nombre: "Otro Admin" }],
    });
    Usuario.findAll.mockResolvedValue([usuarioAdmin()]);

    await expect(
      service.crearPlan({ user: { id: 7 }, data: payload }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringMatching(/participantes invitados/i),
    });
    expect(ConsejoEjecutivoPlan.create).not.toHaveBeenCalled();
  });

  test("lista exclusivamente los planes de una sala autorizada", async () => {
    ConsejoEjecutivoPlan.findAll.mockResolvedValue([planCompleto()]);

    const planes = await service.listarPlanes({
      user: { id: 4 },
      filtros: { salaId: 5, condicion: "normal" },
    });

    expect(salasService.obtenerSalaAutorizada).toHaveBeenCalledWith(5, { id: 4 });
    expect(ConsejoEjecutivoPlan.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { salaId: 5, condicion: "normal" },
      }),
    );
    expect(planes).toHaveLength(1);
  });

  test("evita sobrescribir una revision que ya cambio", async () => {
    ConsejoEjecutivoPlan.findByPk.mockResolvedValue({ revision: 3, salaId: 5 });

    await expect(
      service.actualizarPlan({
        id: 19,
        user: { id: 7 },
        data: { ...payload, revision: 2 },
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(ConsejoEjecutivoPlan.update).not.toHaveBeenCalled();
  });

  test("incrementa la revision mediante una actualizacion condicional", async () => {
    ConsejoEjecutivoPlan.findByPk
      .mockResolvedValueOnce({ revision: 1, salaId: 5 })
      .mockResolvedValueOnce(planCompleto({ revision: 2 }));
    Usuario.findAll.mockResolvedValue([usuarioAdmin()]);
    ConsejoEjecutivoPlan.update.mockResolvedValue([1]);

    const resultado = await service.actualizarPlan({
      id: 19,
      user: { id: 8 },
      data: { ...payload, revision: 1 },
    });

    expect(ConsejoEjecutivoPlan.update).toHaveBeenCalledWith(
      expect.objectContaining({ revision: 2, actualizadoPorId: 8 }),
      { where: { id: 19, revision: 1 } },
    );
    expect(resultado.revision).toBe(2);
  });
});
