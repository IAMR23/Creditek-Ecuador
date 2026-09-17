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
  validarEntregaEnAgencia: jest.fn(),
  validarVersion: jest.fn((entrega, expectedVersion) => {
    if (Number(entrega.version) !== Number(expectedVersion)) {
      throw Object.assign(new Error("Version obsoleta"), {
        statusCode: 409,
        code: "ENTREGA_DESACTUALIZADA",
      });
    }
  }),
}));

const Entrega = require("../../models/Entrega");
const EntregaEvento = require("../../models/EntregaEvento");
const { actualizarTipoEntrega } = require("./tipoEntregaController");

const crearRespuesta = () => {
  const res = { status: jest.fn(), json: jest.fn() };
  res.status.mockReturnValue(res);
  return res;
};

describe("actualizarTipoEntrega", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    EntregaEvento.findOne.mockResolvedValue(null);
    EntregaEvento.create.mockResolvedValue({ id: 1 });
  });

  test.each(["Entrega", "Envio"])("guarda y audita el tipo permitido %s", async (tipoEntrega) => {
    const registro = {
      id: 15,
      estado: "Pendiente",
      version: 2,
      tipoEntrega: "Entrega",
      update: jest.fn().mockImplementation(async (datos) => Object.assign(registro, datos)),
    };
    Entrega.findByPk.mockResolvedValue(registro);
    const req = {
      params: { id: "15" },
      body: { tipoEntrega, expectedVersion: 2, idempotencyKey: `tipo-${tipoEntrega}` },
      user: { id: 8 },
      get: jest.fn(),
    };
    const res = crearRespuesta();

    await actualizarTipoEntrega(req, res);

    expect(registro.update).toHaveBeenCalledWith(
      { tipoEntrega, version: 3 },
      { transaction: mockTransaction },
    );
    expect(EntregaEvento.create).toHaveBeenCalledWith(
      expect.objectContaining({ tipo: "TIPO_ENTREGA_CAMBIADO", actorUsuarioId: 8 }),
      { transaction: mockTransaction },
    );
    expect(mockTransaction.commit).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true, version: 3 }));
  });

  test("rechaza un tipo no permitido sin consultar la base", async () => {
    const req = { params: { id: "15" }, body: { tipoEntrega: "Retiro" }, get: jest.fn() };
    const res = crearRespuesta();
    await actualizarTipoEntrega(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(Entrega.findByPk).not.toHaveBeenCalled();
  });

  test("responde 404 cuando la entrega no existe", async () => {
    Entrega.findByPk.mockResolvedValue(null);
    const req = {
      params: { id: "99" },
      body: { tipoEntrega: "Entrega", expectedVersion: 0 },
      get: jest.fn(),
    };
    const res = crearRespuesta();
    await actualizarTipoEntrega(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(mockTransaction.rollback).toHaveBeenCalled();
  });
});
