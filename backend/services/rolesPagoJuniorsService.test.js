jest.mock("../models/RolPago", () => ({
  findAll: jest.fn(),
}));
jest.mock("../models/RolPagoJunior", () => ({
  findAll: jest.fn(),
  findOne: jest.fn(),
  findByPk: jest.fn(),
  create: jest.fn(),
}));

const RolPago = require("../models/RolPago");
const RolPagoJunior = require("../models/RolPagoJunior");
const service = require("./rolesPagoJuniorsService");

describe("rolesPagoJuniorsService", () => {
  beforeEach(() => jest.clearAllMocks());

  test("lista relaciones con ambos cargos", async () => {
    RolPagoJunior.findAll.mockResolvedValue([{
      id: 1,
      cargoRolPagoId: 10,
      juniorRolPagoId: 20,
      activo: true,
      cargo: { id: 10, cargo: "JEFE COMERCIAL", nivel: "JEFATURA" },
      junior: { id: 20, cargo: "SUPERVISOR", nivel: "SUPERVISION" },
    }]);
    await expect(service.listar()).resolves.toEqual([expect.objectContaining({
      id: 1,
      cargoRolPagoId: 10,
      juniorRolPagoId: 20,
      cargo: expect.objectContaining({ cargo: "JEFE COMERCIAL" }),
      junior: expect.objectContaining({ cargo: "SUPERVISOR" }),
    })]);
  });

  test("crea una relacion valida", async () => {
    RolPago.findAll.mockResolvedValue([{ id: 10, activo: true }, { id: 20, activo: true }]);
    RolPagoJunior.findAll.mockResolvedValue([]);
    RolPagoJunior.findOne.mockResolvedValue(null);
    RolPagoJunior.create.mockResolvedValue({ id: 7 });
    RolPagoJunior.findByPk.mockResolvedValue({
      id: 7,
      cargoRolPagoId: 10,
      juniorRolPagoId: 20,
      activo: true,
      cargo: { id: 10, cargo: "JEFE" },
      junior: { id: 20, cargo: "ASISTENTE" },
    });

    await expect(service.crear({ cargoRolPagoId: 10, juniorRolPagoId: 20 }))
      .resolves.toMatchObject({ id: 7, cargoRolPagoId: 10, juniorRolPagoId: 20 });
    expect(RolPagoJunior.create).toHaveBeenCalledWith({
      cargoRolPagoId: 10,
      juniorRolPagoId: 20,
      activo: true,
    });
  });

  test("rechaza que el cargo sea junior de si mismo", async () => {
    await expect(service.crear({ cargoRolPagoId: 10, juniorRolPagoId: 10 }))
      .rejects.toMatchObject({ statusCode: 400 });
    expect(RolPago.findAll).not.toHaveBeenCalled();
  });

  test("rechaza ciclos entre cargos", async () => {
    RolPago.findAll.mockResolvedValue([{ id: 10, activo: true }, { id: 20, activo: true }]);
    RolPagoJunior.findAll.mockResolvedValue([{
      cargoRolPagoId: 20,
      juniorRolPagoId: 10,
    }]);
    await expect(service.crear({ cargoRolPagoId: 10, juniorRolPagoId: 20 }))
      .rejects.toThrow("La relación generaría un ciclo entre cargos");
    expect(RolPagoJunior.create).not.toHaveBeenCalled();
  });

  test("desactiva sin eliminar la relacion", async () => {
    const update = jest.fn().mockResolvedValue(undefined);
    RolPagoJunior.findByPk
      .mockResolvedValueOnce({ id: 7, cargoRolPagoId: 10, juniorRolPagoId: 20, activo: true, update })
      .mockResolvedValueOnce({ id: 7, cargoRolPagoId: 10, juniorRolPagoId: 20, activo: false });
    await expect(service.cambiarEstado(7, false)).resolves.toMatchObject({ id: 7, activo: false });
    expect(update).toHaveBeenCalledWith({ activo: false });
  });
});
