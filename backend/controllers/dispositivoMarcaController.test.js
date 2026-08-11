jest.mock("../config/db", () => ({
  sequelize: {
    transaction: jest.fn((callback) => callback({ id: "transaction" })),
  },
}));
jest.mock("../models/Dispositivo", () => ({}));
jest.mock("../models/DispositivoMarca", () => ({
  findByPk: jest.fn(),
}));
jest.mock("../models/Marca", () => ({}));
jest.mock("../models/Modelo", () => ({
  update: jest.fn(),
}));

const DispositivoMarca = require("../models/DispositivoMarca");
const Modelo = require("../models/Modelo");
const controller = require("./dispositivoMarcaController");

const crearRespuesta = () => {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
};

const crearRelacion = ({ activo = true } = {}) => ({
  id: 12,
  activo,
  save: jest.fn().mockResolvedValue(undefined),
  toJSON() {
    return { id: this.id, activo: this.activo };
  },
});

describe("dispositivoMarcaController.actualizarDispositivoMarca", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("desactiva los modelos relacionados dentro de la misma transaccion", async () => {
    const relacion = crearRelacion();
    DispositivoMarca.findByPk.mockResolvedValue(relacion);
    Modelo.update.mockResolvedValue([3]);
    const res = crearRespuesta();

    await controller.actualizarDispositivoMarca(
      { params: { id: "12" }, body: { activo: false } },
      res,
    );

    expect(relacion.save).toHaveBeenCalledWith({
      transaction: { id: "transaction" },
    });
    expect(Modelo.update).toHaveBeenCalledWith(
      { activo: false },
      {
        where: { dispositivoMarcaId: 12, activo: true },
        transaction: { id: "transaction" },
      },
    );
    expect(res.json).toHaveBeenCalledWith({
      id: 12,
      activo: false,
      modelosDesactivados: 3,
    });
  });

  test("no reactiva automaticamente los modelos relacionados", async () => {
    const relacion = crearRelacion({ activo: false });
    DispositivoMarca.findByPk.mockResolvedValue(relacion);
    const res = crearRespuesta();

    await controller.actualizarDispositivoMarca(
      { params: { id: "12" }, body: { activo: true } },
      res,
    );

    expect(Modelo.update).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({
      id: 12,
      activo: true,
      modelosDesactivados: 0,
    });
  });

  test("responde 404 cuando la relacion no existe", async () => {
    DispositivoMarca.findByPk.mockResolvedValue(null);
    const res = crearRespuesta();

    await controller.actualizarDispositivoMarca(
      { params: { id: "99" }, body: { activo: false } },
      res,
    );

    expect(Modelo.update).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: "Relación no encontrada" });
  });
});
