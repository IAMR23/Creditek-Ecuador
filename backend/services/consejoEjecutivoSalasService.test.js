jest.mock("../config/db", () => ({
  sequelize: {
    transaction: jest.fn((callback) => callback({ id: "transaction" })),
  },
}));
jest.mock("../models/ConsejoEjecutivoSala", () => ({
  create: jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
}));
jest.mock("../models/ConsejoEjecutivoSalaParticipante", () => ({
  bulkCreate: jest.fn(),
  findAll: jest.fn(),
  update: jest.fn(),
}));
jest.mock("../models/ConsejoEjecutivoPlan", () => ({}));
jest.mock("../models/Usuario", () => ({}));
jest.mock("./consejoEjecutivoUsuariosService", () => ({
  consultarUsuariosAdmin: jest.fn(),
}));

const ConsejoEjecutivoSala = require("../models/ConsejoEjecutivoSala");
const ConsejoEjecutivoSalaParticipante = require("../models/ConsejoEjecutivoSalaParticipante");
const usuariosService = require("./consejoEjecutivoUsuariosService");
const service = require("./consejoEjecutivoSalasService");

const admin = (id, nombre = `Admin ${id}`) => ({
  id,
  nombre,
  email: `admin${id}@creditek.ec`,
});

const salaModelo = (datos = {}) => ({
  get: () => ({
    id: 5,
    nombre: "Consejo semanal",
    descripcion: "Seguimiento gerencial",
    creadoPorId: 7,
    creadoPor: { id: 7, nombre: "Gerencia" },
    participantes: [admin(4), admin(6)],
    planes: [{ id: 1 }, { id: 2 }],
    createdAt: "2026-08-13T10:00:00.000Z",
    updatedAt: "2026-08-13T10:00:00.000Z",
    ...datos,
  }),
});

describe("servicio de salas del Consejo Ejecutivo", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    usuariosService.consultarUsuariosAdmin.mockImplementation(async ({ ids }) =>
      (ids || []).map((id) => admin(Number(id))),
    );
  });

  test("crea una sala e invita solamente a los Admin seleccionados", async () => {
    ConsejoEjecutivoSala.create.mockResolvedValue({ id: 5 });
    ConsejoEjecutivoSalaParticipante.bulkCreate.mockResolvedValue([]);
    ConsejoEjecutivoSala.findOne.mockResolvedValue(salaModelo());

    const resultado = await service.crearSala({
      user: { id: 7 },
      data: {
        nombre: "Consejo semanal",
        descripcion: "Seguimiento gerencial",
        participanteIds: [4, 6],
      },
    });

    expect(ConsejoEjecutivoSalaParticipante.bulkCreate).toHaveBeenCalledWith(
      [
        expect.objectContaining({ salaId: 5, usuarioId: 4, activo: true }),
        expect.objectContaining({ salaId: 5, usuarioId: 6, activo: true }),
      ],
      { transaction: { id: "transaction" } },
    );
    expect(resultado.participantes).toHaveLength(2);
    expect(resultado.puedeAdministrar).toBe(true);
  });

  test("rechaza una invitacion si uno de los usuarios ya no es Admin", async () => {
    usuariosService.consultarUsuariosAdmin.mockResolvedValue([admin(4)]);

    await expect(
      service.crearSala({
        user: { id: 7 },
        data: { nombre: "Consejo", participanteIds: [4, 9] },
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringMatching(/rol Admin/i),
    });
    expect(ConsejoEjecutivoSala.create).not.toHaveBeenCalled();
  });

  test("lista solo salas creadas o invitadas que conservan participantes Admin", async () => {
    ConsejoEjecutivoSalaParticipante.findAll.mockResolvedValue([{ salaId: 5 }]);
    ConsejoEjecutivoSala.findAll.mockResolvedValue([salaModelo()]);

    const salas = await service.listarSalas({ user: { id: 4 } });

    expect(salas).toHaveLength(1);
    expect(salas[0]).toEqual(
      expect.objectContaining({
        id: 5,
        totalPlanes: 2,
        puedeAdministrar: false,
      }),
    );
  });

  test("impide entrar a quien no fue invitado", async () => {
    ConsejoEjecutivoSala.findOne.mockResolvedValue(salaModelo());

    await expect(
      service.obtenerSalaAutorizada(5, { id: 99 }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  test("actualiza invitaciones sin borrar su historial", async () => {
    ConsejoEjecutivoSala.findOne
      .mockResolvedValueOnce(salaModelo())
      .mockResolvedValueOnce(
        salaModelo({ participantes: [admin(4), admin(8)] }),
      );
    ConsejoEjecutivoSala.update.mockResolvedValue([1]);
    ConsejoEjecutivoSalaParticipante.update.mockResolvedValue([2]);
    ConsejoEjecutivoSalaParticipante.bulkCreate.mockResolvedValue([]);

    const resultado = await service.actualizarSala({
      id: 5,
      user: { id: 7 },
      data: {
        nombre: "Consejo actualizado",
        descripcion: "",
        participanteIds: [4, 8],
      },
    });

    expect(ConsejoEjecutivoSalaParticipante.update).toHaveBeenCalledWith(
      { activo: false },
      expect.objectContaining({ where: { salaId: 5, activo: true } }),
    );
    expect(ConsejoEjecutivoSalaParticipante.bulkCreate).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ usuarioId: 4, activo: true }),
        expect.objectContaining({ usuarioId: 8, activo: true }),
      ]),
      expect.objectContaining({
        updateOnDuplicate: ["activo", "invitadoPorId", "updatedAt"],
      }),
    );
    expect(resultado.participantes.map((item) => item.id)).toEqual([4, 8]);
  });
});
