jest.mock("../config/db", () => ({
  sequelize: {
    transaction: jest.fn((callback) => callback({ id: "transaction" })),
  },
}));
jest.mock("../models/DescuentoDecimo", () => ({
  findAll: jest.fn(),
  bulkCreate: jest.fn(),
}));
jest.mock("../models/Usuario", () => ({
  findAll: jest.fn(),
}));

const DescuentoDecimo = require("../models/DescuentoDecimo");
const Usuario = require("../models/Usuario");
const {
  guardarDescuentosDecimos,
  obtenerDescuentosDecimos,
} = require("./descuentosDecimosService");

describe("descuentosDecimosService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("lista todos los usuarios y completa valores vacios", async () => {
    Usuario.findAll.mockResolvedValue([
      { id: 1, nombre: "Ana", activo: true },
      { id: 2, nombre: "Bruno", activo: false },
    ]);
    DescuentoDecimo.findAll.mockResolvedValue([
      {
        id: 8,
        usuarioId: 1,
        valor: "482.00",
        decimoCuarto: true,
        decimoTercero: false,
        vacaciones: false,
        observaciones: "Préstamo solicitado",
      },
    ]);

    const resultado = await obtenerDescuentosDecimos(2026);

    expect(resultado.anio).toBe(2026);
    expect(resultado.registros).toEqual([
      expect.objectContaining({
        usuarioId: 1,
        nombre: "Ana",
        valor: 482,
        decimoCuarto: true,
      }),
      expect.objectContaining({
        usuarioId: 2,
        nombre: "Bruno",
        usuarioActivo: false,
        valor: 0,
        observaciones: "",
      }),
    ]);
  });

  test("guarda registros por usuario y año en una transaccion", async () => {
    Usuario.findAll.mockResolvedValue([{ id: 1 }, { id: 2 }]);
    DescuentoDecimo.bulkCreate.mockResolvedValue([]);

    const resultado = await guardarDescuentosDecimos(
      {
        anio: 2026,
        registros: [
          {
            usuarioId: 1,
            valor: "482,00",
            decimoCuarto: true,
            decimoTercero: false,
            vacaciones: false,
            observaciones: "Adelanto",
          },
          {
            usuarioId: 2,
            valor: 0,
            decimoCuarto: false,
            decimoTercero: true,
            vacaciones: true,
            observaciones: "",
          },
        ],
      },
      99,
    );

    expect(DescuentoDecimo.bulkCreate).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          usuarioId: 1,
          anio: 2026,
          valor: 482,
          decimoCuarto: true,
          actualizadoPorId: 99,
        }),
        expect.objectContaining({
          usuarioId: 2,
          anio: 2026,
          decimoTercero: true,
          vacaciones: true,
        }),
      ],
      expect.objectContaining({
        transaction: { id: "transaction" },
        updateOnDuplicate: expect.arrayContaining([
          "valor",
          "decimoCuarto",
          "observaciones",
        ]),
      }),
    );
    expect(resultado).toEqual({ anio: 2026, total: 2 });
  });

  test("rechaza años fuera del rango permitido", async () => {
    await expect(obtenerDescuentosDecimos(1999)).rejects.toMatchObject({
      statusCode: 400,
    });
    expect(Usuario.findAll).not.toHaveBeenCalled();
  });
});
