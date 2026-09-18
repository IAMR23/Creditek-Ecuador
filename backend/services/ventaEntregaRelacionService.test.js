jest.mock("../models/Cliente", () => ({
  findAll: jest.fn(),
}));
jest.mock("../models/DetalleVenta", () => ({}));
jest.mock("../models/Venta", () => ({
  findAll: jest.fn(),
}));
jest.mock("../config/db", () => ({
  sequelize: {
    query: jest.fn(),
  },
}));

const Cliente = require("../models/Cliente");
const Venta = require("../models/Venta");
const { sequelize } = require("../config/db");
const {
  consolidarFilasInforme,
  normalizarCedula,
  obtenerDashboardVentasConEntrega,
  obtenerInformeVentasConEntrega,
  obtenerPaginaInformeVentasConEntrega,
  resolverVentaParaEntrega,
  seleccionarVentaInequivoca,
} = require("./ventaEntregaRelacionService");

describe("relacion entre ventas y entregas", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("relaciona una entrega con la unica venta activa del mismo clienteId", async () => {
    Venta.findAll.mockResolvedValue([{ id: 41, detalleVenta: [] }]);

    const resultado = await resolverVentaParaEntrega({
      clienteId: 8,
      cedula: "0912345678",
      detalle: {},
      transaction: {},
    });

    expect(resultado.ventaId).toBe(41);
    expect(resultado.tipoCoincidencia).toBe("CLIENTE_ID");
    expect(resultado.ambigua).toBe(false);
  });

  test("usa una cedula unica como respaldo cuando clienteId no coincide", async () => {
    Venta.findAll
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 52, detalleVenta: [] }]);
    Cliente.findAll.mockResolvedValue([{ id: 12 }]);

    const resultado = await resolverVentaParaEntrega({
      clienteId: 99,
      cedula: "0912345678",
      detalle: {},
      transaction: {},
    });

    expect(resultado).toEqual(
      expect.objectContaining({
        ventaId: 52,
        tipoCoincidencia: "CEDULA",
        ambigua: false,
      }),
    );
  });

  test("normaliza cedulas con espacios y guiones", () => {
    expect(normalizarCedula(" 091-234-5678 ")).toBe("0912345678");
    expect(normalizarCedula("179-001-234-5001")).toBe("1790012345001");
  });

  test.each([null, "", "   ", "12-34", "sin cedula"])(
    "no compara una cedula vacia o invalida: %p",
    (cedula) => {
      expect(normalizarCedula(cedula)).toBeNull();
    },
  );

  test("no escoge arbitrariamente cuando el cliente tiene varias ventas", async () => {
    Venta.findAll.mockResolvedValue([
      { id: 61, detalleVenta: [] },
      { id: 62, detalleVenta: [] },
    ]);

    const resultado = await resolverVentaParaEntrega({
      clienteId: 20,
      cedula: "0912345678",
      detalle: {},
    });

    expect(resultado.ventaId).toBeNull();
    expect(resultado.ambigua).toBe(true);
    expect(resultado.advertencia.codigo).toBe("VENTA_AMBIGUA");
  });

  test("contrato y modelo desambiguan solo si queda una venta", () => {
    const candidatas = [
      {
        id: 71,
        detalleVenta: [{ contrato: "CTR-001", modeloId: 10 }],
      },
      {
        id: 72,
        detalleVenta: [{ contrato: "CTR-002", modeloId: 11 }],
      },
    ];

    expect(
      seleccionarVentaInequivoca(candidatas, {
        contrato: " ctr-002 ",
        modeloId: 11,
      }),
    ).toEqual(
      expect.objectContaining({
        venta: candidatas[1],
        ambigua: false,
        criterio: "CONTRATO",
      }),
    );
  });

  test("una venta con varias entregas directas aparece una sola vez", () => {
    const filas = consolidarFilasInforme([
      {
        ventaId: 80,
        entregaId: 801,
        fechaEntrega: "2026-09-10",
        fechaRegistroEntrega: "2026-09-10T09:30:00.000Z",
        tipoRelacion: "DIRECTA",
      },
      {
        ventaId: 80,
        entregaId: 802,
        fechaEntrega: "2026-09-11",
        fechaRegistroEntrega: "2026-09-11T15:45:00.000Z",
        tipoRelacion: "DIRECTA",
      },
      {
        ventaId: 80,
        entregaId: 802,
        fechaEntrega: "2026-09-11",
        fechaRegistroEntrega: "2026-09-11T15:45:00.000Z",
        tipoRelacion: "DIRECTA",
      },
    ]);

    expect(filas).toHaveLength(1);
    expect(filas[0]).toEqual(
      expect.objectContaining({
        entregaId: 802,
        fechaRegistroEntrega: "2026-09-11T15:45:00.000Z",
        cantidadEntregas: 2,
        tipoRelacion: "DIRECTA",
        relacionAmbigua: false,
      }),
    );
  });

  test("varias entregas por cedula se muestran una vez y como ambiguas", () => {
    const filas = consolidarFilasInforme([
      {
        ventaId: 90,
        entregaId: 901,
        tipoRelacion: "POR_CEDULA",
        cantidadVentasCedula: 1,
      },
      {
        ventaId: 90,
        entregaId: 902,
        tipoRelacion: "POR_CEDULA",
        cantidadVentasCedula: 1,
      },
    ]);

    expect(filas).toHaveLength(1);
    expect(filas[0].cantidadEntregas).toBe(2);
    expect(filas[0].relacionAmbigua).toBe(true);
  });

  test("una entrega por cedula frente a varias ventas tambien queda ambigua", () => {
    const [fila] = consolidarFilasInforme([
      {
        ventaId: 100,
        entregaId: 1001,
        tipoRelacion: "POR_CEDULA",
        cantidadVentasCedula: 3,
      },
    ]);

    expect(fila.tipoRelacion).toBe("POR_CEDULA");
    expect(fila.relacionAmbigua).toBe(true);
  });

  test("una relacion directa prevalece sobre coincidencias historicas", () => {
    const [fila] = consolidarFilasInforme([
      {
        ventaId: 110,
        entregaId: 1101,
        tipoRelacion: "POR_CEDULA",
        cantidadVentasCedula: 2,
      },
      {
        ventaId: 110,
        entregaId: 1102,
        tipoRelacion: "DIRECTA",
        cantidadVentasCedula: 2,
      },
    ]);

    expect(fila.entregaId).toBe(1102);
    expect(fila.tipoRelacion).toBe("DIRECTA");
    expect(fila.relacionAmbigua).toBe(false);
  });

  test("una venta sin entrega no genera filas en el informe", () => {
    expect(consolidarFilasInforme([])).toEqual([]);
  });

  test("aplica todos los filtros solicitados al informe", async () => {
    sequelize.query.mockResolvedValue([]);

    await obtenerInformeVentasConEntrega({
      fechaInicio: "2026-09-01",
      fechaFin: "2026-09-14",
      horaRegistroDesde: "13:30",
      agenciaIds: "2,5,2",
      vendedorIds: ["3", "7"],
      origenId: "4",
      soloOrigenEntrega: "true",
      estadoEntrega: "Entregado",
      tipoEntrega: "Envio",
    });

    expect(sequelize.query).toHaveBeenCalledWith(
      expect.stringMatching(
        /control_financiero_registros[\s\S]+fechaControlLocal[\s\S]+CAST\(:fechaInicio AS DATE\)[\s\S]+fechaControlLocal[\s\S]+::TIME[\s\S]+LOWER\(TRIM[\s\S]+INNER JOIN relaciones/,
      ),
      expect.objectContaining({
        replacements: expect.objectContaining({
          fechaInicio: "2026-09-01",
          fechaFin: "2026-09-14",
          horaRegistroDesde: "13:30",
          agenciaIds: "2,5",
          vendedorIds: "3,7",
          origenId: 4,
          soloOrigenEntrega: true,
          estadoEntrega: "Entregado",
          tipoEntrega: "Envio",
          limite: null,
          offset: 0,
        }),
      }),
    );
  });

  test("aplica el rango y la hora diaria sobre la fecha de Control Financiero", async () => {
    sequelize.query.mockResolvedValue([]);

    await obtenerInformeVentasConEntrega({
      fechaInicio: "2026-09-01",
      fechaFin: "2026-09-15",
      horaRegistroDesde: "21:00",
    });

    const [sql] = sequelize.query.mock.calls[0];

    expect(sql).toMatch(
      /control\."fechaControlLocal"\s+>= CAST\(:fechaInicio AS DATE\)/,
    );
    expect(sql).toMatch(
      /control\."fechaControlLocal"\s+< CAST\(:fechaFin AS DATE\) \+ INTERVAL '1 day'/,
    );
    expect(sql).toMatch(
      /control\."fechaControlLocal"::TIME\s+>= CAST\(:horaRegistroDesde AS TIME\)/,
    );
    expect(sql).toMatch(/control_financiero_registros registro/);
    expect(sql).toMatch(/registro\.imei_normalizado[\s\S]+detalle\.referencia_pdf_normalizada/);
    expect(sql).toMatch(/registro\.contrato_normalizado[\s\S]+detalle\.contrato_normalizado/);
    expect(sql).not.toMatch(/TO_TIMESTAMP/);
    expect(sql).not.toMatch(/v\."createdAt" AT TIME ZONE/);
    expect(sql).not.toMatch(/v\.fecha\s+[<>]= CAST\(:fecha(?:Inicio|Fin) AS DATE\)/);
  });

  test("agrupa entregas y ventas desde la hora por mes", async () => {
    sequelize.query.mockResolvedValue([
      { tipo: "ENTREGAS", mes: "2026-08", cantidad: "12" },
      { tipo: "ENTREGAS", mes: "2026-09", cantidad: 8 },
      { tipo: "VENTAS_DESDE_HORA", mes: "2026-08", cantidad: "5" },
    ]);

    const dashboard = await obtenerDashboardVentasConEntrega({
      fechaInicio: "2026-08-01",
      fechaFin: "2026-09-30",
      horaRegistroDesde: "21:00",
      agenciaId: "2",
      soloOrigenEntrega: "true",
      tipoEntrega: "Entrega",
    });

    expect(dashboard).toEqual({
      entregasPorMes: [
        { mes: "2026-08", cantidad: 12 },
        { mes: "2026-09", cantidad: 8 },
      ],
      ventasDesdeHoraPorMes: [{ mes: "2026-08", cantidad: 5 }],
    });
    expect(sequelize.query).toHaveBeenCalledWith(
      expect.stringMatching(
        /COUNT\(DISTINCT relacion\."entregaId"\)[\s\S]+COUNT\(DISTINCT relacion\."ventaId"\)[\s\S]+horaRegistroDesde/,
      ),
      expect.objectContaining({
        replacements: expect.objectContaining({
          fechaInicio: "2026-08-01",
          fechaFin: "2026-09-30",
          horaRegistroDesde: "21:00",
          agenciaIds: "2",
          soloOrigenEntrega: true,
          tipoEntrega: "Entrega",
        }),
      }),
    );
  });

  test("descarta una hora invalida y desactiva el filtro de origen por defecto", async () => {
    sequelize.query.mockResolvedValue([]);

    await obtenerInformeVentasConEntrega({
      horaRegistroDesde: "25:90",
      tipoEntrega: "Retiro",
    });

    expect(sequelize.query).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        replacements: expect.objectContaining({
          horaRegistroDesde: null,
          soloOrigenEntrega: false,
          tipoEntrega: null,
        }),
      }),
    );
  });

  test("pagina en SQL y conserva los totales del conjunto completo", async () => {
    sequelize.query.mockResolvedValue([
      {
        ventaId: 301,
        entregaId: 401,
        tipoRelacion: "DIRECTA",
        cantidadVentasCedula: 1,
        _total: 52,
        _totalDirectas: 30,
        _totalPorCedula: 18,
        _totalAmbiguas: 4,
      },
    ]);

    const resultado = await obtenerPaginaInformeVentasConEntrega({
      page: "2",
      limit: "25",
    });

    expect(resultado).toEqual(
      expect.objectContaining({
        page: 2,
        limit: 25,
        total: 52,
        totalPages: 3,
        resumen: { directas: 30, porCedula: 18, ambiguas: 4 },
      }),
    );
    expect(resultado.ventas).toHaveLength(1);
    expect(sequelize.query.mock.calls[0][1].replacements).toEqual(
      expect.objectContaining({ limite: 25, offset: 25 }),
    );
  });

  test("la consulta de exportacion no aplica limite", async () => {
    sequelize.query.mockResolvedValue([
      { ventaId: 501, entregaId: 601, tipoRelacion: "DIRECTA" },
      { ventaId: 502, entregaId: 602, tipoRelacion: "POR_CEDULA" },
    ]);

    const ventas = await obtenerInformeVentasConEntrega({ limit: 1 });

    expect(ventas).toHaveLength(2);
    expect(sequelize.query.mock.calls[0][1].replacements).toEqual(
      expect.objectContaining({ limite: null, offset: 0 }),
    );
  });

  test("conserva el total si se solicita una pagina fuera de rango", async () => {
    sequelize.query
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ _total: 12, _totalDirectas: 7 }]);

    const resultado = await obtenerPaginaInformeVentasConEntrega({
      page: 9,
      limit: 25,
    });

    expect(resultado.ventas).toEqual([]);
    expect(resultado.total).toBe(12);
    expect(resultado.totalPages).toBe(1);
    expect(sequelize.query).toHaveBeenCalledTimes(2);
    expect(sequelize.query.mock.calls[1][1].replacements).toEqual(
      expect.objectContaining({ limite: 1, offset: 0 }),
    );
  });

  test("prioriza IMEI y luego contrato al seleccionar Control Financiero", async () => {
    sequelize.query.mockResolvedValue([]);

    await obtenerInformeVentasConEntrega({});
    const [sql] = sequelize.query.mock.calls[0];

    expect(sql).toMatch(/0 AS prioridad[\s\S]+imei_normalizado/);
    expect(sql).toMatch(/1 AS prioridad[\s\S]+contrato_normalizado/);
    expect(sql).toMatch(
      /ORDER BY[\s\S]+candidato\.prioridad[\s\S]+fecha_normalizada DESC[\s\S]+id DESC/,
    );
  });

  test("rechaza un rango de fechas invertido antes de consultar", async () => {
    await expect(
      obtenerInformeVentasConEntrega({
        fechaInicio: "2026-09-15",
        fechaFin: "2026-09-01",
      }),
    ).rejects.toMatchObject({ status: 400 });
    expect(sequelize.query).not.toHaveBeenCalled();
  });
});
