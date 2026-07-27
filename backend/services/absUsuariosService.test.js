const {
  construirUrlUsuarioAbs,
  consultarUsuarioAbsPorCedula,
} = require("./absUsuariosService");

describe("absUsuariosService", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    process.env.ABS_SYNC_URL = "http://abs-interno:5030";
    process.env.ABS_SYNC_TOKEN = "token-abs";
  });

  afterAll(() => {
    delete process.env.ABS_SYNC_URL;
    delete process.env.ABS_SYNC_TOKEN;
  });

  test("construye la URL usando la cedula como unico criterio", () => {
    expect(
      construirUrlUsuarioAbs("http://abs-interno:5030/", " 0102030405 "),
    ).toBe(
      "http://abs-interno:5030/api/integraciones/rve/usuarios/por-cedula/0102030405",
    );
  });

  test("consulta ABS con token interno y no envia otros criterios", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          ok: true,
          encontrado: true,
          usuario: { cedula: "0102030405", nombre: "María Pérez" },
        }),
    });

    const resultado = await consultarUsuarioAbsPorCedula("0102030405");

    expect(resultado.encontrado).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://abs-interno:5030/api/integraciones/rve/usuarios/por-cedula/0102030405",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          "x-internal-token": "token-abs",
        }),
      }),
    );
  });

  test("informa cuando la integracion no esta configurada", async () => {
    delete process.env.ABS_SYNC_URL;

    await expect(
      consultarUsuarioAbsPorCedula("0102030405"),
    ).rejects.toMatchObject({ statusCode: 503 });
  });
});
