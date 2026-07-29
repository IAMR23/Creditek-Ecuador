jest.mock("axios", () => ({
  get: jest.fn(),
}));

jest.mock("../models/MapaUbicacionNormalizada", () => ({
  bulkCreate: jest.fn(),
  count: jest.fn(),
  findAll: jest.fn(),
  update: jest.fn(),
}));

const axios = require("axios");
const MapaUbicacionNormalizada = require("../models/MapaUbicacionNormalizada");
const {
  encolarVentasParaNormalizar,
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
        yaEnCola: 1,
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
});
