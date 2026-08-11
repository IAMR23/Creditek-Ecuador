jest.mock("../config/db", () => ({
  sequelize: {
    transaction: jest.fn((callback) => callback({ id: "transaction" })),
  },
}));
jest.mock("../models/CostoHistorico", () => ({
  findAll: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
}));
jest.mock("../models/Modelo", () => ({ findAll: jest.fn() }));
jest.mock("../models/Dispositivo", () => ({}));
jest.mock("../models/DispositivoMarca", () => ({}));
jest.mock("../models/Marca", () => ({}));

const CostoHistorico = require("../models/CostoHistorico");
const Modelo = require("../models/Modelo");
const {
  guardarListaPrecios,
  obtenerListaPrecios,
} = require("./listaPreciosService");

const modeloCelular = {
  id: 10,
  nombre: "MAGIC 8 LITE",
  activo: true,
  dispositivoMarca: {
    marca: { nombre: "HONOR" },
    dispositivo: { nombre: "CELULAR" },
  },
};

describe("listaPreciosService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Modelo.findAll.mockResolvedValue([modeloCelular]);
  });

  test("devuelve el precio historico vigente por modelo", async () => {
    CostoHistorico.findAll.mockResolvedValue([
      {
        id: 2,
        modeloId: 10,
        fechaCompra: "2026-08-01",
        precioCarga: "500.00",
        precioContado: "485.00",
        precioTarjetaCredito: "490.00",
      },
      {
        id: 1,
        modeloId: 10,
        fechaCompra: "2026-07-01",
        precioCarga: "480.00",
        precioContado: "470.00",
        precioTarjetaCredito: "470.00",
      },
    ]);

    const resultado = await obtenerListaPrecios({
      fechaVigencia: "2026-08-11",
    });

    expect(resultado.precios).toEqual([
      expect.objectContaining({
        modeloId: 10,
        activo: true,
        marca: "HONOR",
        tipo: "MOVIL",
        costoHistoricoId: 2,
        precioCarga: 500,
        precioContado: 485,
        precioTarjetaCredito: 490,
      }),
    ]);
    expect(Modelo.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { activo: true },
        include: [
          expect.objectContaining({
            where: { activo: true },
            required: true,
            include: expect.arrayContaining([
              expect.objectContaining({
                as: "marca",
                where: { activo: true },
                required: true,
              }),
              expect.objectContaining({
                as: "dispositivo",
                where: { activo: true },
                required: true,
              }),
            ]),
          }),
        ],
      }),
    );
  });

  test("crea una nueva vigencia copiando el costo historico anterior", async () => {
    CostoHistorico.findAll.mockResolvedValue([
      {
        id: 2,
        modeloId: 10,
        fechaCompra: "2026-08-01",
        costo: 300,
        precioCarga: 500,
        precioContado: 485,
        precioTarjetaCredito: 485,
      },
    ]);
    CostoHistorico.create.mockResolvedValue({ id: 3 });

    const resultado = await guardarListaPrecios({
      fechaVigencia: "2026-08-11",
      precios: [
        {
          modeloId: 10,
          precioCarga: 510,
          precioContado: 495,
          precioTarjetaCredito: 498,
        },
      ],
    });

    expect(CostoHistorico.create).toHaveBeenCalledWith(
      expect.objectContaining({
        modeloId: 10,
        costo: 300,
        fechaCompra: "2026-08-11",
        precioCarga: 510,
        precioContado: 495,
        precioTarjetaCredito: 498,
      }),
      { transaction: { id: "transaction" } },
    );
    expect(resultado).toEqual(
      expect.objectContaining({ total: 1, creados: 1, actualizados: 0 }),
    );
  });

  test("actualiza el historico cuando ya existe la misma vigencia", async () => {
    CostoHistorico.findAll.mockResolvedValue([
      {
        id: 3,
        modeloId: 10,
        fechaCompra: "2026-08-11",
        costo: 300,
        precioCarga: 500,
        precioContado: 485,
        precioTarjetaCredito: 485,
      },
    ]);

    const resultado = await guardarListaPrecios({
      fechaVigencia: "2026-08-11",
      precios: [
        {
          modeloId: 10,
          precioCarga: 520,
          precioContado: 500,
          precioTarjetaCredito: "",
        },
      ],
    });

    expect(CostoHistorico.update).toHaveBeenCalledWith(
      expect.objectContaining({
        precioCarga: 520,
        precioContado: 500,
        precioTarjetaCredito: 500,
      }),
      { where: { id: 3 }, transaction: { id: "transaction" } },
    );
    expect(CostoHistorico.create).not.toHaveBeenCalled();
    expect(resultado).toEqual(
      expect.objectContaining({ total: 1, creados: 0, actualizados: 1 }),
    );
  });
});
