const {
  clasificarUbicacionPermitida,
  construirMapaComercial,
  extraerCoordenadasGooglePermitidas,
  extraerCoordenadasGoogleRedireccion,
  getRankingDispositivos,
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

  test("extrae coordenadas solo desde formatos permitidos de Google Maps", () => {
    expect(
      extraerCoordenadasGooglePermitidas("https://www.google.com/maps?q=-0.7588503,-78.6146328&z=17&hl=es"),
    ).toEqual({ latitud: -0.7588503, longitud: -78.6146328 });

    expect(
      extraerCoordenadasGooglePermitidas("https://www.google.com/maps/place/0%C2%B019'48.5%22S+78%C2%B031'19.6%22W/@-0.3301367,-78.5246749,17z/data=!3m1!4b1!4m4!3m3!8m2!3d-0.3301367!4d-78.5221?hl=es&entry=ttu"),
    ).toEqual({ latitud: -0.3301367, longitud: -78.5221 });

    expect(
      extraerCoordenadasGooglePermitidas("https://www.google.com/maps/place/Sector/@-0.3301367,-78.5246749,17z"),
    ).toEqual({ latitud: -0.3301367, longitud: -78.5246749 });

    expect(extraerCoordenadasGooglePermitidas("-0.7588503,-78.6146328")).toBeNull();
    expect(extraerCoordenadasGooglePermitidas("Puente 7")).toBeNull();
    expect(
      extraerCoordenadasGooglePermitidas("https://www.google.com/maps/search/?api=1&query=-0.305,-78.45"),
    ).toBeNull();
  });

  test("extrae coordenadas desde URL final de redireccion de maps.app.goo.gl", () => {
    expect(
      extraerCoordenadasGoogleRedireccion("https://www.google.com/maps/search/GOOGLE+MAPS/@-0.3264925,-78.562782,3a,75y,234.99h,92.21t/data=!3m7!1e1"),
    ).toEqual({ latitud: -0.3264925, longitud: -78.562782 });
  });

  test("clasifica solo ubicaciones permitidas para mapa comercial", () => {
    expect(clasificarUbicacionPermitida("https://maps.app.goo.gl/abc123")).toBe("enlace_corto_google");
    expect(clasificarUbicacionPermitida("https://www.google.com/maps?q=-0.7588503,-78.6146328")).toBe("google_maps_q");
    expect(clasificarUbicacionPermitida("https://www.google.com/maps/place/Sector/@-0.3301367,-78.5246749,17z")).toBe("google_maps_place");
    expect(clasificarUbicacionPermitida("Puente 7")).toBe("formato_no_permitido");
    expect(clasificarUbicacionPermitida("-0.7588503,-78.6146328")).toBe("formato_no_permitido");
    expect(clasificarUbicacionPermitida("https://www.google.com/maps/place/Sector")).toBe("google_sin_coordenadas");
  });
});
