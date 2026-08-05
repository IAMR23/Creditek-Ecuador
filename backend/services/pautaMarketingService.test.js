const {
  MAX_CONTENIDOS_POR_PAGINA,
  TIPOS_CONTENIDO,
  normalizarBooleano,
  normalizarFecha,
  normalizarSeguidores,
  resolverContenidos,
  serializarPautaMarketing,
  validarPautaMarketing,
} = require("./pautaMarketingService");

describe("pautaMarketingService", () => {
  test("incluye los tipos de contenido principales", () => {
    expect(TIPOS_CONTENIDO).toEqual(
      expect.arrayContaining(["Video", "Carrusel", "Post", "Reel", "Historia"]),
    );
  });

  test("normaliza varios contenidos dentro de una pagina", () => {
    const resultado = validarPautaMarketing({
      nombrePagina: "  Tecnologia Ecuador ",
      seguidoresFacebook: "15000",
      seguidoresInstagram: 2300,
      seguidoresTiktok: "",
      contenidos: JSON.stringify([
        {
          producto: " Honor X8D ",
          tipoContenido: " Video ",
          fecha: "2026-07-28",
          cumplidoFacebook: true,
          cumplidoInstagram: false,
          cumplidoTiktok: true,
        },
        {
          producto: " TV 55 pulgadas ",
          tipoContenido: " Carrusel ",
          fecha: "2026-07-29",
        },
      ]),
    });

    expect(resultado.errores).toEqual([]);
    expect(resultado.data).toMatchObject({
      producto: "Honor X8D",
      nombrePagina: "Tecnologia Ecuador",
      tipoContenido: "Video",
      seguidoresFacebook: 15000,
      seguidoresInstagram: 2300,
      seguidoresTiktok: 0,
      contenidos: [
        {
          producto: "Honor X8D",
          tipoContenido: "Video",
          fecha: "2026-07-28",
          cumplidoFacebook: true,
          cumplidoInstagram: false,
          cumplidoTiktok: true,
        },
        {
          producto: "TV 55 pulgadas",
          tipoContenido: "Carrusel",
          fecha: "2026-07-29",
        },
      ],
    });
  });

  test("mantiene compatibilidad con producto y tipo de contenido antiguos", () => {
    const resultado = resolverContenidos({
      producto: "Celular",
      tipoContenido: "Post",
    });

    expect(resultado.errores).toEqual([]);
    expect(resultado.contenidos).toEqual([
      {
        producto: "Celular",
        tipoContenido: "Post",
        fecha: null,
        cumplidoFacebook: false,
        cumplidoInstagram: false,
        cumplidoTiktok: false,
      },
    ]);
  });

  test("rechaza listas invalidas o con demasiados contenidos", () => {
    expect(resolverContenidos({ contenidos: "{invalido" }).errores).toContain(
      "La lista de contenidos no es valida",
    );

    const demasiados = Array.from(
      { length: MAX_CONTENIDOS_POR_PAGINA + 1 },
      () => ({ producto: "TV", tipoContenido: "Video" }),
    );
    expect(resolverContenidos({ contenidos: demasiados }).errores[0]).toContain(
      "Solo se permiten",
    );
  });

  test("permite contenidos vacios o con campos opcionales", () => {
    const vacio = validarPautaMarketing({ nombrePagina: "Pagina Uno" });
    const incompleto = validarPautaMarketing({
      nombrePagina: "Pagina Uno",
      contenidos: [{ producto: "", tipoContenido: "Video" }],
    });

    expect(vacio.errores).toEqual([]);
    expect(vacio.data.contenidos).toEqual([]);
    expect(incompleto.errores).toEqual([]);
    expect(incompleto.data.contenidos).toEqual([
      {
        producto: "",
        tipoContenido: "Video",
        fecha: null,
        cumplidoFacebook: false,
        cumplidoInstagram: false,
        cumplidoTiktok: false,
      },
    ]);
  });

  test("rechaza cantidades negativas, decimales o fuera del limite", () => {
    expect(normalizarSeguidores(-1).valido).toBe(false);
    expect(normalizarSeguidores("15.5").valido).toBe(false);
    expect(normalizarSeguidores("1000000000000").valido).toBe(false);
  });

  test("valida la fecha solo cuando fue informada", () => {
    expect(normalizarFecha("2026-07-28")).toEqual({
      valido: true,
      valor: "2026-07-28",
    });
    expect(normalizarFecha("2026-02-30").valido).toBe(false);

    const sinFecha = validarPautaMarketing({
      nombrePagina: "Pagina Uno",
      contenidos: [{ producto: "TV", tipoContenido: "Video" }],
    });
    const fechaInvalida = validarPautaMarketing({
      nombrePagina: "Pagina Uno",
      contenidos: [
        { producto: "TV", tipoContenido: "Video", fecha: "2026-02-30" },
      ],
    });

    expect(sinFecha.errores).toEqual([]);
    expect(fechaInvalida.errores).toContain(
      "La fecha del contenido 1 no es valida",
    );
  });

  test("normaliza el cumplimiento de las redes sociales", () => {
    expect(normalizarBooleano(true)).toEqual({ valido: true, valor: true });
    expect(normalizarBooleano("false")).toEqual({
      valido: true,
      valor: false,
    });
    expect(normalizarBooleano("desconocido").valido).toBe(false);
  });

  test("serializa los contenidos y BIGINT para el frontend", () => {
    expect(
      serializarPautaMarketing({
        id: 8,
        nombrePagina: "Pagina Uno",
        imagen: "/uploads/marketing/imagen.webp",
        seguidoresFacebook: "1000",
        seguidoresInstagram: "2000",
        seguidoresTiktok: "3000",
        contenidos: [
          {
            producto: "TV",
            tipoContenido: "Carrusel",
            fecha: "2026-07-28",
            cumplidoFacebook: true,
            cumplidoInstagram: false,
            cumplidoTiktok: true,
          },
          {
            producto: "Celular",
            tipoContenido: "Video",
            fecha: "2026-07-29",
          },
        ],
      }),
    ).toMatchObject({
      id: 8,
      seguidoresFacebook: 1000,
      seguidoresInstagram: 2000,
      seguidoresTiktok: 3000,
      contenidos: [
        {
          producto: "TV",
          tipoContenido: "Carrusel",
          fecha: "2026-07-28",
          cumplidoFacebook: true,
          cumplidoInstagram: false,
          cumplidoTiktok: true,
        },
        {
          producto: "Celular",
          tipoContenido: "Video",
          fecha: "2026-07-29",
        },
      ],
    });
  });
});
