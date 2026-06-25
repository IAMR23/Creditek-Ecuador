const {
  clasificarUbicacion,
  construirMapaComercial,
  extraerCoordenadasDeTexto,
  getRankingDispositivos,
  pickUbicacion,
} = require("./mapaComercialService");

describe("mapaComercialService", () => {
  const zonasCobertura = [
    {
      id: 1,
      agenciaId: 10,
      nombre: "Puente 7",
      latitudCentro: "-0.3050000",
      longitudCentro: "-78.4500000",
      radioMetros: 900,
      agencia: { nombre: "Sangolqui" },
    },
    {
      id: 2,
      agenciaId: 10,
      nombre: "Centro",
      latitudCentro: "-0.3100000",
      longitudCentro: "-78.4600000",
      radioMetros: 900,
      agencia: { nombre: "Sangolqui" },
    },
  ];

  test("suma cantidad de detalle, no filas", () => {
    const ventas = [
      {
        detalleVentaId: 1,
        fecha: "2026-06-18",
        cantidad: 2,
        agenciaId: 10,
        agencia: "Sangolqui",
        vendedor: "Ana",
        marca: "Samsung",
        modelo: "A15",
        zonaNombre: "Puente 7",
      },
      {
        detalleVentaId: 2,
        fecha: "2026-06-18",
        cantidad: 3,
        agenciaId: 10,
        agencia: "Sangolqui",
        vendedor: "Ana",
        marca: "Samsung",
        modelo: "A15",
        zonaNombre: "Puente 7",
      },
    ];

    const data = construirMapaComercial({ ventas, zonasCobertura });

    expect(data.resumen.totalDispositivos).toBe(5);
    expect(data.zonasConVentas[0].totalDispositivos).toBe(5);
  });

  test("calcula zonas sin ventas solo desde cobertura configurada", () => {
    const data = construirMapaComercial({
      ventas: [
        {
          detalleVentaId: 1,
          fecha: "2026-06-18",
          cantidad: 1,
          agenciaId: 10,
          agencia: "Sangolqui",
          marca: "Samsung",
          modelo: "A15",
          zonaNombre: "Puente 7",
        },
      ],
      zonasCobertura,
    });

    expect(data.resumen.zonasConVentas).toBe(1);
    expect(data.resumen.zonasSinVentas).toBe(1);
    expect(data.zonasSinVentas[0].zona).toBe("Centro");
    expect(data.resumen.coberturaComercial).toBe(50);
  });

  test("ranking de dispositivos calcula porcentaje y numero de zonas", () => {
    const ranking = getRankingDispositivos([
      {
        cantidad: 2,
        marca: "Samsung",
        modelo: "A15",
        zonaNombre: "Puente 7",
      },
      {
        cantidad: 1,
        marca: "Samsung",
        modelo: "A15",
        zonaNombre: "Centro",
      },
      {
        cantidad: 1,
        marca: "Honor",
        modelo: "X7",
        zonaNombre: "Centro",
      },
    ]);

    expect(ranking[0]).toMatchObject({
      posicion: 1,
      marca: "Samsung",
      modelo: "A15",
      cantidad: 3,
      porcentaje: 75,
      zonas: 2,
    });
  });

  test("extrae coordenadas desde formatos de Google Maps", () => {
    expect(
      extraerCoordenadasDeTexto("https://www.google.com/maps/@-0.123456,-78.456789,17z"),
    ).toEqual({ latitud: -0.123456, longitud: -78.456789 });

    expect(
      extraerCoordenadasDeTexto("https://www.google.com/maps/search/?api=1&query=-0.305,-78.45"),
    ).toEqual({ latitud: -0.305, longitud: -78.45 });

    expect(
      extraerCoordenadasDeTexto("https://maps.google.com/?q=-0.22,-78.51"),
    ).toEqual({ latitud: -0.22, longitud: -78.51 });

    expect(
      extraerCoordenadasDeTexto("https://www.google.com/maps?q=-0.7588503,-78.6146328&z=17&hl=es"),
    ).toEqual({ latitud: -0.7588503, longitud: -78.6146328 });

    expect(
      extraerCoordenadasDeTexto("https://www.google.com/maps/place/0%C2%B019'48.5%22S+78%C2%B031'19.6%22W/@-0.3301367,-78.5246749,17z/data=!3m1!4b1!4m4!3m3!8m2!3d-0.3301367!4d-78.5221?hl=es&entry=ttu"),
    ).toEqual({ latitud: -0.3301367, longitud: -78.5221 });

    expect(extraerCoordenadasDeTexto("0°19'48.5\"S 78°31'19.6\"W")).toEqual({
      latitud: -0.3301389,
      longitud: -78.5221111,
    });
  });

  test("clasifica ubicaciones y prioriza enlaces sobre textos", () => {
    expect(clasificarUbicacion("Puente 7")).toBe("texto");
    expect(clasificarUbicacion("https://maps.app.goo.gl/abc123")).toBe("enlace_corto_google");
    expect(
      pickUbicacion(["Puente 7", "https://www.google.com/maps/@-0.123,-78.456,17z"]),
    ).toBe("https://www.google.com/maps/@-0.123,-78.456,17z");
  });
});
