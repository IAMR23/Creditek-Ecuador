const mockTransaction = {
  LOCK: { UPDATE: "UPDATE" },
  commit: jest.fn(),
  rollback: jest.fn(),
};

jest.mock("../../config/db", () => ({
  sequelize: { transaction: jest.fn(async () => mockTransaction) },
}));
jest.mock("../../models/Entrega", () => ({ findByPk: jest.fn() }));
jest.mock("../../models/EntregaEvento", () => ({ findOne: jest.fn(), create: jest.fn() }));
jest.mock("../../services/entregaOperacionService", () => ({
  actualizarEstado: jest.fn(),
  crearError: (statusCode, code, message) => Object.assign(new Error(message), { statusCode, code }),
  validarEntregaEnAgencia: jest.fn(),
  validarVersion: jest.fn(),
}));

const { sequelize } = require("../../config/db");
const Entrega = require("../../models/Entrega");
const EntregaEvento = require("../../models/EntregaEvento");
const {
  actualizarEstado,
  validarVersion,
} = require("../../services/entregaOperacionService");
const {
  actualizarCamposGenerales,
  cambiarEstado,
} = require("./entregaOperacionController");

const respuesta = () => {
  const res = { status: jest.fn(), json: jest.fn() };
  res.status.mockReturnValue(res);
  return res;
};

describe("edicion general de entrega", () => {
  beforeEach(() => jest.clearAllMocks());

  test("rechaza estado antes de iniciar una transaccion", async () => {
    const req = { body: { estado: "Transito", expectedVersion: 1 }, params: { id: "9" } };
    const res = respuesta();
    await actualizarCamposGenerales(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: "CAMPOS_NO_PERMITIDOS", campos: ["estado"] }),
    );
    expect(sequelize.transaction).not.toHaveBeenCalled();
  });

  test("actualiza solo campos permitidos sin alterar el estado", async () => {
    const entrega = {
      id: 9,
      usuarioAgenciaId: 3,
      estado: "Transito",
      version: 4,
      update: jest.fn().mockImplementation(async (cambios) => Object.assign(entrega, cambios)),
      toJSON: jest.fn(() => ({ id: 9, estado: entrega.estado, version: entrega.version })),
    };
    Entrega.findByPk.mockResolvedValue(entrega);
    EntregaEvento.findOne.mockResolvedValue(null);
    EntregaEvento.create.mockResolvedValue({ id: 1 });
    const req = {
      body: {
        errores: ["Retraso"],
        expectedVersion: 4,
        motivo: "Revision logistica",
        idempotencyKey: "datos-9",
      },
      params: { id: "9" },
      user: { id: 2, agenciaId: 1, permisos: ["Logistica"] },
      get: jest.fn(),
    };
    const res = respuesta();

    await actualizarCamposGenerales(req, res);

    expect(validarVersion).toHaveBeenCalledWith(entrega, 4);
    expect(entrega.update).toHaveBeenCalledWith(
      { errores: ["Retraso"], version: 5 },
      { transaction: mockTransaction },
    );
    expect(entrega.estado).toBe("Transito");
    expect(EntregaEvento.create).toHaveBeenCalledWith(
      expect.objectContaining({ estadoAnterior: "Transito", estadoNuevo: "Transito" }),
      { transaction: mockTransaction },
    );
    expect(mockTransaction.commit).toHaveBeenCalled();
  });
});

describe("cambio de estado por repartidor", () => {
  beforeEach(() => jest.clearAllMocks());

  test("autoriza por usuario estable y no por la agencia actual", async () => {
    actualizarEstado.mockResolvedValue({
      entrega: { id: 9, version: 5 },
      idempotente: false,
    });
    const req = {
      body: {
        estado: "Entregado",
        expectedVersion: 4,
        motivo: "Cliente recibio",
      },
      params: { id: "9" },
      user: {
        id: 13,
        usuarioAgenciaId: 118,
        agenciaId: 9,
        rol: "Repartidor",
        permisos: ["Logistica"],
      },
      get: jest.fn(),
    };
    const res = respuesta();

    await cambiarEstado(req, res);

    expect(actualizarEstado).toHaveBeenCalledWith(
      expect.objectContaining({
        entregaId: "9",
        responsableRequeridoUsuarioId: 13,
        scopeAgenciaId: null,
      }),
    );
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ ok: true, version: 5 }),
    );
  });
});
