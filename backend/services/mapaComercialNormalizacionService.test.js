jest.mock("axios", () => ({
  get: jest.fn(),
}));

jest.mock("../models/MapaUbicacionNormalizada", () => ({
  bulkCreate: jest.fn(),
  count: jest.fn(),
  findAll: jest.fn(),
  sync: jest.fn(),
  update: jest.fn(),
}));

const axios = require("axios");
const MapaUbicacionNormalizada = require("../models/MapaUbicacionNormalizada");
const {
  encolarVentasParaNormalizar,
  normalizarVenta,
  persistirCoordenadasLocales,
  procesarColaNormalizaciones,
  resolverEnlaceCorto,
} = require("./mapaComercialNormalizacionService");

describe("mapaComercialNormalizacionService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("encola en base de datos sin resolver enlaces dentro de la peticion", async () => {
    MapaUbicacionNormalizada.findAll.mockResolvedValue([
      { id: 20, entidadId: 2, estadoGeocodificacion: "procesado" },
      { id: 30, entidadId: 3, estadoGeocodificacion: "error" },
      { id: 40, entidadId: 4, estadoGeocodificacion: "pendiente" },
    ]);
    MapaUbicacionNormalizada.bulkCreate.mockResolvedValue([]);

    const resultado = await encolarVentasParaNormalizar({
      ventas: [
        {
          ventaId: 1,
          ubicacionOriginal: "https://maps.app.goo.gl/nueva",
        },
        {
          ventaId: 2,
          ubicacionOriginal: "https://www.google.com/maps?q=-0.3,-78.4",
        },
        {
          ventaId: 3,
          ubicacionOriginal: "https://maps.app.goo.gl/reintento",
        },
        {
          ventaId: 4,
          ubicacionOriginal: "https://maps.app.goo.gl/ya-encolada",
        },
      ],
      limit: 100,
    });

    expect(resultado).toEqual({
      resumen: {
        encolados: 2,
        nuevosEncolados: 1,
        reintentosEncolados: 1,
        yaEnCola: 1,
        yaProcesados: 1,
        omitidosPorLimite: 0,
        omitidos: 1,
        totalVentas: 4,
      },
    });
    expect(MapaUbicacionNormalizada.bulkCreate).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          entidadId: 1,
          estadoGeocodificacion: "pendiente",
        }),
        expect.objectContaining({
          entidadId: 3,
          estadoGeocodificacion: "pendiente",
        }),
      ]),
      expect.objectContaining({
        updateOnDuplicate: expect.arrayContaining([
          "estadoGeocodificacion",
          "updatedAt",
        ]),
      }),
    );
    expect(axios.get).not.toHaveBeenCalled();
  });

  test("extrae el enlace yige desde Location sin solicitar la pagina final", async () => {
    const urlFinal = "https://www.google.com/maps/place/Entrega/@-0.0473636,-79.3494866,17z/data=!3d-0.0473636!4d-79.3494866";
    axios.get.mockResolvedValueOnce({
      status: 302,
      headers: { location: urlFinal },
      data: "",
    });

    const resultado = await normalizarVenta({
      ventaId: 10,
      ubicacionOriginal: "https://maps.app.goo.gl/yigePd9LnXR2ghVx6",
    });

    expect(resultado).toMatchObject({
      estadoGeocodificacion: "procesado",
      latitud: -0.0473636,
      longitud: -79.3494866,
      precision: "extraida_redireccion",
    });
    expect(axios.get).toHaveBeenCalledTimes(1);
    expect(axios.get).toHaveBeenCalledWith(
      "https://maps.app.goo.gl/yigePd9LnXR2ghVx6",
      expect.objectContaining({ maxRedirects: 0, timeout: 12000 }),
    );
    expect(axios.get).not.toHaveBeenCalledWith(urlFinal, expect.anything());
  });

  test("persiste coordenadas incluidas en URLs sin consultar Google", async () => {
    MapaUbicacionNormalizada.findAll.mockResolvedValue([
      { entidadId: 2, estadoGeocodificacion: "manual" },
    ]);
    MapaUbicacionNormalizada.bulkCreate.mockResolvedValue([]);

    const resultado = await persistirCoordenadasLocales({
      ventas: [
        {
          ventaId: 1,
          ubicacionOriginal: "https://www.google.com/maps?q=0.0016425,-78.4469972&z=17&hl=es",
        },
        {
          ventaId: 2,
          ubicacionOriginal: "https://www.google.com/maps/place/Sector/@-0.174888,-78.4841069,730m/data=!3d-0.174888!4d-78.4815322",
        },
        {
          ventaId: 3,
          ubicacionOriginal: "https://goo.gl/maps/gKbDQtT2difrU4RB8",
        },
      ],
    });

    expect(resultado).toEqual({ guardadas: 1, yaGuardadas: 1 });
    expect(MapaUbicacionNormalizada.bulkCreate).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          entidadId: 1,
          latitud: 0.0016425,
          longitud: -78.4469972,
          estadoGeocodificacion: "procesado",
        }),
      ],
      expect.objectContaining({
        updateOnDuplicate: expect.arrayContaining(["latitud", "longitud"]),
      }),
    );
    expect(axios.get).not.toHaveBeenCalled();
  });

  test("sigue varias redirecciones permitidas, incluidas las relativas", async () => {
    axios.get
      .mockResolvedValueOnce({
        status: 302,
        headers: { location: "https://www.google.com/maps/continuar" },
        data: "",
      })
      .mockResolvedValueOnce({
        status: 307,
        headers: { location: "/maps/place/Entrega/@-0.305,-78.45,17z" },
        data: "",
      });

    await expect(
      resolverEnlaceCorto("https://goo.gl/maps/gKbDQtT2difrU4RB8"),
    ).resolves.toBe("https://www.google.com/maps/place/Entrega/@-0.305,-78.45,17z");
    expect(axios.get).toHaveBeenCalledTimes(2);
  });

  test("rechaza una redireccion hacia un dominio externo", async () => {
    axios.get.mockResolvedValueOnce({
      status: 302,
      headers: { location: "https://example.com/maps?q=-0.30,-78.45" },
      data: "",
    });

    await expect(
      resolverEnlaceCorto("https://maps.app.goo.gl/externa"),
    ).rejects.toThrow("sitio no permitido");
    expect(axios.get).toHaveBeenCalledTimes(1);
  });

  test("prioriza una ubicacion nueva sobre cien reintentos antiguos", async () => {
    const antiguas = Array.from({ length: 100 }, (_, index) => ({
      id: index + 1,
      entidadId: index + 1,
      estadoGeocodificacion: index % 2 ? "error" : "omitido",
    }));
    const ventas = antiguas.map((item) => ({
      ventaId: item.entidadId,
      ubicacionOriginal: `https://maps.app.goo.gl/antigua-${item.entidadId}`,
    }));
    ventas.push({
      ventaId: 999,
      ubicacionOriginal: "https://maps.app.goo.gl/nueva-prioritaria",
    });
    MapaUbicacionNormalizada.findAll.mockResolvedValue(antiguas);
    MapaUbicacionNormalizada.bulkCreate.mockResolvedValue([]);

    const resultado = await encolarVentasParaNormalizar({ ventas, limit: 1 });

    expect(resultado.resumen).toMatchObject({
      nuevosEncolados: 1,
      reintentosEncolados: 0,
      omitidosPorLimite: 100,
    });
    expect(MapaUbicacionNormalizada.bulkCreate.mock.calls[0][0]).toEqual([
      expect.objectContaining({ entidadId: 999 }),
    ]);
  });

  test("no reencola procesados ni manuales salvo con force", async () => {
    const existentes = [
      { id: 1, entidadId: 1, estadoGeocodificacion: "procesado" },
      { id: 2, entidadId: 2, estadoGeocodificacion: "manual" },
    ];
    const ventas = existentes.map((item) => ({
      ventaId: item.entidadId,
      ubicacionOriginal: "https://www.google.com/maps?q=-0.30,-78.45",
    }));
    MapaUbicacionNormalizada.findAll.mockResolvedValue(existentes);

    await expect(encolarVentasParaNormalizar({ ventas })).resolves.toEqual({
      resumen: expect.objectContaining({ encolados: 0, yaProcesados: 2 }),
    });
    expect(MapaUbicacionNormalizada.bulkCreate).not.toHaveBeenCalled();

    MapaUbicacionNormalizada.bulkCreate.mockResolvedValue([]);
    const forzado = await encolarVentasParaNormalizar({ ventas, force: true });
    expect(forzado.resumen).toMatchObject({
      encolados: 2,
      reintentosEncolados: 2,
      yaProcesados: 0,
    });
  });

  test("registra timeout y 429 sin detener los demas registros", async () => {
    MapaUbicacionNormalizada.update.mockResolvedValue([1]);
    MapaUbicacionNormalizada.findAll.mockResolvedValue([
      { id: 1, entidadId: 1, ubicacionOriginal: "https://maps.app.goo.gl/timeout" },
      { id: 2, entidadId: 2, ubicacionOriginal: "https://maps.app.goo.gl/limite" },
      { id: 3, entidadId: 3, ubicacionOriginal: "https://maps.app.goo.gl/correcta" },
    ]);
    axios.get
      .mockRejectedValueOnce(Object.assign(new Error("timeout"), { code: "ECONNABORTED" }))
      .mockResolvedValueOnce({ status: 429, headers: {}, data: "CAPTCHA" })
      .mockResolvedValueOnce({
        status: 302,
        headers: { location: "https://www.google.com/maps?q=-0.30,-78.45" },
        data: "",
      });

    await expect(procesarColaNormalizaciones({ limit: 3 })).resolves.toEqual({
      procesando: false,
      procesados: 3,
    });

    const cambios = MapaUbicacionNormalizada.update.mock.calls.map(([values]) => values);
    expect(cambios).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          estadoGeocodificacion: "error",
          errorDetalle: expect.stringContaining("Tiempo de espera"),
        }),
        expect.objectContaining({
          estadoGeocodificacion: "error",
          errorDetalle: expect.stringContaining("429/CAPTCHA"),
        }),
        expect.objectContaining({ estadoGeocodificacion: "procesado" }),
      ]),
    );
  });

  test("recupera el esquema si falta la tabla de normalizaciones", async () => {
    MapaUbicacionNormalizada.update.mockRejectedValueOnce({
      message: 'no existe la relacion "mapa_ubicaciones_normalizadas"',
      original: { code: "42P01" },
      sql: 'UPDATE "mapa_ubicaciones_normalizadas" SET ...',
    });
    MapaUbicacionNormalizada.sync.mockResolvedValue();

    await expect(procesarColaNormalizaciones()).resolves.toEqual({
      procesando: false,
      procesados: 0,
      esquemaRecuperado: true,
    });
    expect(MapaUbicacionNormalizada.sync).toHaveBeenCalledTimes(1);
  });
});
