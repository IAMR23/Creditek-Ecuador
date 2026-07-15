const {
  esProcesoCompletoRegistrado,
  resolverProcesoLlamada,
} = require("./procesoLlamadaEntrega");

describe("resolverProcesoLlamada", () => {
  test("permite proceso completo sin fecha ni foto", () => {
    expect(
      resolverProcesoLlamada({
        entrega: { procesoCompleto: true, FechaHoraLlamada: "2026-07-15T10:00" },
        archivoPresente: false,
        fotoUrl: "/foto-anterior.jpg",
      }),
    ).toEqual({
      procesoCompleto: true,
      requisitosCompletos: true,
      fechaHoraLlamada: null,
      fotoFechaLlamada: null,
    });
  });

  test("mantiene fecha y foto en el proceso normal", () => {
    expect(
      resolverProcesoLlamada({
        entrega: { procesoCompleto: false, FechaHoraLlamada: "2026-07-15T10:00" },
        archivoPresente: true,
        fotoUrl: "/uploads/ventas/foto.jpg",
      }),
    ).toEqual({
      procesoCompleto: false,
      requisitosCompletos: true,
      fechaHoraLlamada: "2026-07-15T10:00",
      fotoFechaLlamada: "/uploads/ventas/foto.jpg",
    });
  });

  test.each([
    [{ FechaHoraLlamada: "" }, true],
    [{ FechaHoraLlamada: "2026-07-15T10:00" }, false],
  ])("rechaza el proceso normal incompleto", (entrega, archivoPresente) => {
    const resultado = resolverProcesoLlamada({
      entrega,
      archivoPresente,
      fotoUrl: archivoPresente ? "/uploads/ventas/foto.jpg" : null,
    });

    expect(resultado.requisitosCompletos).toBe(false);
  });
});

describe("esProcesoCompletoRegistrado", () => {
  test("identifica una entrega sin llamada ni foto como proceso completo", () => {
    expect(
      esProcesoCompletoRegistrado({
        FechaHoraLlamada: null,
        fotoFechaLlamada: null,
      }),
    ).toBe(true);
  });

  test.each([
    [{ FechaHoraLlamada: "2026-07-15T10:00", fotoFechaLlamada: null }],
    [{ FechaHoraLlamada: null, fotoFechaLlamada: "/uploads/ventas/foto.jpg" }],
  ])("no marca como completo un registro con evidencia de llamada", (entrega) => {
    expect(esProcesoCompletoRegistrado(entrega)).toBe(false);
  });
});
