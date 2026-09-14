jest.mock("../../models/Entrega", () => ({
  findByPk: jest.fn(),
}));

const Entrega = require("../../models/Entrega");
const {
  actualizarTipoEntrega,
} = require("./tipoEntregaController");

const crearRespuesta = () => {
  const res = {
    status: jest.fn(),
    json: jest.fn(),
  };
  res.status.mockReturnValue(res);
  return res;
};

describe("actualizarTipoEntrega", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test.each(["Entrega", "Envio"])(
    "guarda el tipo permitido %s",
    async (tipoEntrega) => {
      const registro = {
        id: 15,
        tipoEntrega: "Entrega",
        update: jest.fn().mockImplementation(async (datos) => {
          registro.tipoEntrega = datos.tipoEntrega;
        }),
      };
      Entrega.findByPk.mockResolvedValue(registro);
      const req = { params: { id: "15" }, body: { tipoEntrega } };
      const res = crearRespuesta();

      await actualizarTipoEntrega(req, res);

      expect(registro.update).toHaveBeenCalledWith({ tipoEntrega });
      expect(res.json).toHaveBeenCalledWith({
        ok: true,
        message: "Tipo de entrega actualizado.",
        entrega: { id: 15, tipoEntrega },
      });
    },
  );

  test("rechaza un tipo no permitido sin consultar la base", async () => {
    const req = { params: { id: "15" }, body: { tipoEntrega: "Retiro" } };
    const res = crearRespuesta();

    await actualizarTipoEntrega(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(Entrega.findByPk).not.toHaveBeenCalled();
  });

  test("responde 404 cuando la entrega no existe", async () => {
    Entrega.findByPk.mockResolvedValue(null);
    const req = { params: { id: "99" }, body: { tipoEntrega: "Entrega" } };
    const res = crearRespuesta();

    await actualizarTipoEntrega(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });
});
