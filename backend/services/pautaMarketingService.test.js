const {
  MAX_CONTENIDOS_POR_PAGINA,
  TIPOS_CONTENIDO,
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
      { producto: "Celular", tipoContenido: "Post", fecha: null },
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

  test("requiere al menos un contenido con producto y tipo", () => {
    const vacio = validarPautaMarketing({ nombrePagina: "Pagina Uno" });
    const incompleto = validarPautaMarketing({
      nombrePagina: "Pagina Uno",
      contenidos: [{ producto: "", tipoContenido: "Video" }],
    });

    expect(vacio.errores).toContain("Agrega al menos un contenido a la pagina");
    expect(incompleto.errores).toContain(
      "El producto del contenido 1 es obligatorio",
    );
  });

  test("rechaza cantidades negativas, decimales o fuera del limite", () => {
    expect(normalizarSeguidores(-1).valido).toBe(false);
    expect(normalizarSeguidores("15.5").valido).toBe(false);
    expect(normalizarSeguidores("1000000000000").valido).toBe(false);
  });

  test("valida una fecha real en formato ISO por contenido", () => {
    expect(normalizarFecha("2026-07-28")).toEqual({
      valido: true,
      valor: "2026-07-28",
    });
    expect(normalizarFecha("2026-02-30").valido).toBe(false);

    const sinFecha = validarPautaMarketing({
      nombrePagina: "Pagina Uno",
      contenidos: [{ producto: "TV", tipoContenido: "Video" }],
    });
    expect(sinFecha.errores).toContain(
      "La fecha del contenido 1 es obligatoria",
    );
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
