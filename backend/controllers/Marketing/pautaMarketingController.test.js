jest.mock("../../models/Marketing/PautaMarketing", () => ({
  findOne: jest.fn(),
}));

const PautaMarketing = require("../../models/Marketing/PautaMarketing");
const controller = require("./pautaMarketingController");

const crearRespuesta = () => {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
};

const crearPauta = (contenidos) => {
  const pauta = {
    id: 7,
    nombrePagina: "Pagina de prueba",
    imagen: "/uploads/marketing/prueba.webp",
    seguidoresFacebook: 10,
    seguidoresInstagram: 20,
    seguidoresTiktok: 30,
    producto: contenidos[0]?.producto || "",
    tipoContenido: contenidos[0]?.tipoContenido || "",
    contenidos,
    createdAt: new Date("2026-08-01T00:00:00.000Z"),
    updatedAt: new Date("2026-08-01T00:00:00.000Z"),
  };
  pauta.get = jest.fn(() => ({ ...pauta }));
  pauta.update = jest.fn(async (values) => {
    Object.assign(pauta, values);
    return pauta;
  });
  return pauta;
};

describe("pautaMarketingController.eliminarContenido", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("elimina solo el contenido indicado y conserva la pagina", async () => {
    const contenidoUno = {
      producto: "TV",
      tipoContenido: "Video",
      fecha: "2026-08-01",
    };
    const contenidoDos = {
      producto: "Celular",
      tipoContenido: "Reel",
      fecha: "2026-08-02",
    };
    const pauta = crearPauta([contenidoUno, contenidoDos]);
    PautaMarketing.findOne.mockResolvedValue(pauta);
    const res = crearRespuesta();

    await controller.eliminarContenido(
      { params: { id: "7", indice: "0" }, user: { id: 25 } },
      res,
    );

    expect(pauta.update).toHaveBeenCalledWith({
      contenidos: [expect.objectContaining(contenidoDos)],
      producto: "Celular",
      tipoContenido: "Reel",
      actualizadoPorId: 25,
    });
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: true,
        message: "Contenido eliminado correctamente",
        pauta: expect.objectContaining({ id: 7, nombrePagina: "Pagina de prueba" }),
      }),
    );
  });

  test("permite eliminar el ultimo contenido sin eliminar la pagina", async () => {
    const pauta = crearPauta([
      { producto: "TV", tipoContenido: "Post", fecha: "2026-08-03" },
    ]);
    PautaMarketing.findOne.mockResolvedValue(pauta);
    const res = crearRespuesta();

    await controller.eliminarContenido(
      { params: { id: "7", indice: "0" }, user: { id: 25 } },
      res,
    );

    expect(pauta.update).toHaveBeenCalledWith({
      contenidos: [],
      producto: "",
      tipoContenido: "",
      actualizadoPorId: 25,
    });
    expect(res.status).not.toHaveBeenCalled();
  });

  test("rechaza un indice de contenido invalido", async () => {
    const res = crearRespuesta();

    await controller.eliminarContenido(
      { params: { id: "7", indice: "invalido" }, user: { id: 25 } },
      res,
    );

    expect(PautaMarketing.findOne).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      ok: false,
      message: "El contenido indicado no es valido",
    });
  });
});
