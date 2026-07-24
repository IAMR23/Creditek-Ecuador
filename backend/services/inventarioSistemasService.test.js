const {
  DISPOSITIVOS,
  obtenerResumenInventario,
  resolverDispositivo,
  serializarInventario,
  validarInventario,
} = require("./inventarioSistemasService");

describe("inventarioSistemasService", () => {
  test("expone exactamente los ocho dispositivos permitidos", () => {
    expect(DISPOSITIVOS.map((item) => item.label)).toEqual([
      "Laptop",
      "Computador de escritorio",
      "Audífonos",
      "Celular",
      "Cargador de laptop",
      "Cargador de celular",
      "Impresora",
      "Regulador de voltaje",
    ]);
  });

  test("cuenta los activos por tipo de dispositivo", () => {
    const resumen = obtenerResumenInventario([
      { nombre: "Laptop", estado: "OPERATIVO", responsableId: 3 },
      { nombre: "LAPTOP", estado: "EN_MANTENIMIENTO", responsableId: 3 },
      { nombre: "Impresora", estado: "OPERATIVO", responsableId: 5 },
      {
        nombre: "Regulador de voltaje",
        estado: "FUERA_DE_SERVICIO",
        responsableId: 5,
      },
    ]);

    expect(resumen).toMatchObject({
      items: 4,
      operativos: 2,
      mantenimiento: 1,
      fueraServicio: 1,
      responsables: 2,
    });
    expect(resumen.porDispositivo).toHaveLength(8);
    expect(
      resumen.porDispositivo.find((item) => item.value === "LAPTOP"),
    ).toMatchObject({ label: "Laptop", cantidad: 2 });
    expect(
      resumen.porDispositivo.find((item) => item.value === "IMPRESORA"),
    ).toMatchObject({ label: "Impresora", cantidad: 1 });
    expect(
      resumen.porDispositivo.find(
        (item) => item.value === "REGULADOR_VOLTAJE",
      ),
    ).toMatchObject({ label: "Regulador de voltaje", cantidad: 1 });
  });

  test("normaliza un item individual asignado a un responsable", () => {
    const resultado = validarInventario({
      dispositivo: "computador de escritorio",
      estado: "operativo",
      agenciaId: "2",
      responsableId: "9",
      marca: " Dell ",
      modelo: " OptiPlex 7090 ",
      precio: "750.50",
      observacion: " Equipo de recepción ",
    });

    expect(resultado.errores).toEqual([]);
    expect(resultado.data).toEqual({
      nombre: "Computador de escritorio",
      marca: "Dell",
      modelo: "OptiPlex 7090",
      precio: 750.5,
      estado: "OPERATIVO",
      observacion: "Equipo de recepción",
      agenciaId: 2,
      responsableId: 9,
    });
  });

  test("rechaza dispositivos fuera del catálogo y referencias vacías", () => {
    const resultado = validarInventario({ dispositivo: "Router" });

    expect(resultado.errores).toEqual(
      expect.arrayContaining([
        "El dispositivo seleccionado no es válido",
        "La agencia es obligatoria",
        "La persona responsable es obligatoria",
      ]),
    );
  });

  test("acepta precio vacio para historicos y rechaza valores negativos", () => {
    const historico = validarInventario({
      dispositivo: "Laptop",
      agenciaId: 2,
      responsableId: 9,
      precio: "",
    });
    const invalido = validarInventario({
      dispositivo: "Laptop",
      agenciaId: 2,
      responsableId: 9,
      precio: -1,
    });

    expect(historico.errores).toEqual([]);
    expect(historico.data.precio).toBeNull();
    expect(invalido.errores).toContain(
      "El precio debe ser un valor valido mayor o igual a cero",
    );
  });

  test("serializa el nombre interno como dispositivo para el frontend", () => {
    expect(resolverDispositivo("CARGADOR_LAPTOP")?.label).toBe("Cargador de laptop");
    expect(
      serializarInventario({
        id: 1,
        precio: "49.90",
        nombre: "Audífonos",
        estado: "OPERATIVO",
        activo: true,
      }),
    ).toMatchObject({
      dispositivo: "Audífonos",
      dispositivoValor: "AUDIFONOS",
      precio: 49.9,
    });
  });
});
