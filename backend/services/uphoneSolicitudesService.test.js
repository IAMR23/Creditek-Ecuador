const ExcelJS = require("exceljs");

jest.mock("../models/UphoneSolicitud", () => ({}));

const UphoneSolicitud = require("../models/UphoneSolicitud");
const {
  crearDashboard,
  crearCatalogoUsuariosUphone,
  crearResumenVendedores,
  eliminarSolicitud,
  exportarExcel,
  importarExcel,
  listar,
  normalizarCedula,
  parsearExcel,
} = require("./uphoneSolicitudesService");

const HEADERS = [
  "DISTRIBUIDOR",
  "MATRIZ",
  "VENDEDOR",
  "NUMERO DE SOLICTUD",
  "USUARIO",
  "CÉDULA",
  "CLIENTE",
  "TELÉFONO SOLICITUD",
  "TELÉFONO CONTRATO",
  "FECHA SOLICITUD",
  "FECHA CONTRATO",
  "GRUPO ARRENDAMIENTO",
  "ESTADO",
  "ESTADO CONTRATO",
];

const BASE_ROW = [
  "CREDI-TECK CHILLOGALLO",
  "CREDI-TECK MATRIZ",
  "VENDEDOR PRUEBA",
  4795152,
  "USER2026",
  "0123456789",
  "CLIENTE PRUEBA",
  "0999999999",
  "S/N",
  new Date("2026-09-28T09:17:01.000Z"),
  "NO APLICA",
  "D-PREMIUM DPR",
  "PENDIENTE",
  "SOLICITUD_APROBADA_AUTOMATICO",
];

const crearExcel = async (headers = HEADERS, additionalRows = []) => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("ReportUphone1");
  sheet.addRow(["REPORTE SOLICITUDES"]);
  sheet.addRow(headers);
  sheet.addRow(BASE_ROW);
  additionalRows.forEach((row) => sheet.addRow(row));
  return Buffer.from(await workbook.xlsx.writeBuffer());
};

describe("uphoneSolicitudesService.parsearExcel", () => {
  test("lee el formato real y normaliza el numero de solicitud", async () => {
    const parsed = await parsearExcel(await crearExcel());

    expect(parsed.sheetName).toBe("ReportUphone1");
    expect(parsed.records).toHaveLength(1);
    expect(parsed.records[0]).toMatchObject({
      numeroSolicitud: "4795152",
      vendedor: "VENDEDOR PRUEBA",
      cedula: "0123456789",
      cedulaNormalizada: "0123456789",
      estado: "PENDIENTE",
    });
    expect(parsed.records[0].fechaSolicitud.toISOString()).toBe("2026-09-28T14:17:01.000Z");
  });

  test("normaliza formatos equivalentes de cedula", () => {
    expect(normalizarCedula("01-234-56789")).toBe("0123456789");
    expect(normalizarCedula("SIN CEDULA")).toBeNull();
  });

  test("omite una segunda solicitud con la misma cedula dentro del archivo", async () => {
    UphoneSolicitud.bulkCreate = jest.fn(async (rows) =>
      rows.map((item, index) => ({ ...item, id: index + 1 })));
    const duplicateCedulaRow = [...BASE_ROW];
    duplicateCedulaRow[3] = 4795153;
    duplicateCedulaRow[5] = "01-234-56789";
    duplicateCedulaRow[6] = "CLIENTE REPETIDO";

    const result = await importarExcel({
      file: {
        buffer: await crearExcel(HEADERS, [duplicateCedulaRow]),
        originalname: "solicitudes.xlsx",
      },
      usuarioId: 8,
    });

    expect(UphoneSolicitud.bulkCreate).toHaveBeenCalledWith([
      expect.objectContaining({
        numeroSolicitud: "4795152",
        cedula: "0123456789",
        cedulaNormalizada: "0123456789",
      }),
    ], expect.objectContaining({ ignoreDuplicates: true }));
    expect(result).toMatchObject({ insertadas: 1, omitidasDuplicadas: 1 });
  });

  test("reporta como duplicada una cedula que la base ya rechazo", async () => {
    UphoneSolicitud.bulkCreate = jest.fn().mockResolvedValue([]);

    const result = await importarExcel({
      file: {
        buffer: await crearExcel(),
        originalname: "solicitudes.xlsx",
      },
      usuarioId: 8,
    });

    expect(result).toMatchObject({ insertadas: 0, omitidasDuplicadas: 1 });
  });

  test("acepta el encabezado SOLICITUD escrito correctamente", async () => {
    const headers = HEADERS.map((header) =>
      header === "NUMERO DE SOLICTUD" ? "NÚMERO DE SOLICITUD" : header,
    );
    const parsed = await parsearExcel(await crearExcel(headers));
    expect(parsed.records[0].numeroSolicitud).toBe("4795152");
  });

  test("rechaza archivos que no contienen todas las columnas requeridas", async () => {
    await expect(parsearExcel(await crearExcel(HEADERS.slice(0, -1)))).rejects.toMatchObject({
      code: "COLUMNAS_FALTANTES",
      statusCode: 400,
    });
  });
});

describe("uphoneSolicitudesService.crearDashboard", () => {
  test("resume estados y resultados por agencia", () => {
    const dashboard = crearDashboard([
      {
        distribuidor: "Agencia Norte",
        matriz: "Matriz",
        estado: "PENDIENTE",
        estadoContrato: "SOLICITUD_APROBADA_AUTOMATICO",
        cantidad: "3",
      },
      {
        distribuidor: "Agencia Norte",
        matriz: "Matriz",
        estado: "FINALIZADA",
        estadoContrato: "SOLICITUD_DENEGADA",
        cantidad: "2",
      },
      {
        distribuidor: null,
        matriz: "Agencia Sur",
        estado: "APROBADA",
        estadoContrato: "SOLICITUD_DENEGADA",
        cantidad: "1",
      },
    ], 6);

    expect(dashboard).toMatchObject({
      totalSolicitudes: 6,
      totalAprobadas: 3,
      totalDenegadas: 3,
      totalOtros: 0,
      agenciaLider: {
        agencia: "AGENCIA NORTE",
        total: 5,
        aprobadas: 3,
        denegadas: 2,
      },
    });
    expect(dashboard.estados).toEqual([
      { estado: "PENDIENTE", cantidad: 3 },
      { estado: "FINALIZADA", cantidad: 2 },
      { estado: "APROBADA", cantidad: 1 },
    ]);
    expect(dashboard.agencias[1]).toMatchObject({
      agencia: "AGENCIA SUR",
      total: 1,
      denegadas: 1,
    });
  });

  test("separa las solicitudes invalidadas por un contrato aprobado", () => {
    const dashboard = crearDashboard([
      {
        distribuidor: "Agencia Norte",
        matriz: "Matriz",
        estado: "INVALIDADA_POR_CONTRATO_APROBADO",
        estadoContrato: "INVALIDADA_POR_CONTRATO_APROBADO",
        cantidad: "2",
      },
    ], 2);

    expect(dashboard).toMatchObject({
      totalSolicitudes: 2,
      totalInvalidadas: 2,
      totalAprobadas: 0,
      totalDenegadas: 0,
      totalOtros: 0,
    });
    expect(dashboard.agencias[0]).toMatchObject({
      agencia: "AGENCIA NORTE",
      invalidadas: 2,
    });
  });
});

describe("uphoneSolicitudesService.crearResumenVendedores", () => {
  test("presenta el nombre RVE y conserva el usuario Uphone", () => {
    expect(crearResumenVendedores([
      {
        usuarioId: "12",
        vendedor: "Andrea Pérez",
        usuarioUphone: "ARI2028",
        vinculado: true,
        clientes: "7",
      },
      {
        usuarioId: null,
        vendedor: "SINMAPEO",
        usuarioUphone: "SINMAPEO",
        vinculado: false,
        clientes: "2",
      },
    ])).toEqual([
      {
        usuarioId: 12,
        vendedor: "Andrea Pérez",
        usuarioUphone: "ARI2028",
        vinculado: true,
        clientes: 7,
      },
      {
        usuarioId: null,
        vendedor: "SINMAPEO",
        usuarioUphone: "SINMAPEO",
        vinculado: false,
        clientes: 2,
      },
    ]);
  });
});

describe("uphoneSolicitudesService.crearCatalogoUsuariosUphone", () => {
  test("expone solo usuarios que tienen codigo Uphone", () => {
    expect(crearCatalogoUsuariosUphone([
      { id: "5", nombre: "María López", usuarioUphone: " MARIA2026 " },
      { id: "8", nombre: "Sin código", usuarioUphone: null },
    ])).toEqual([
      { id: 5, nombre: "María López", usuarioUphone: "MARIA2026" },
    ]);
  });
});

describe("uphoneSolicitudesService.listar", () => {
  test("aplica al dashboard el rango de fechas solicitado", async () => {
    UphoneSolicitud.findAndCountAll = jest.fn().mockResolvedValue({ count: 0, rows: [] });
    UphoneSolicitud.count = jest.fn().mockResolvedValue(10);
    UphoneSolicitud.sequelize = { query: jest.fn()
      .mockResolvedValueOnce([
        {
          distribuidor: "Agencia Centro",
          matriz: "Matriz",
          estado: "FINALIZADA",
          estadoContrato: "SOLICITUD_APROBADA",
          cantidad: "2",
        },
      ])
      .mockResolvedValueOnce([
        {
          usuarioId: 5,
          vendedor: "María López",
          usuarioUphone: "MARIA2026",
          vinculado: true,
          clientes: "2",
        },
      ])
      .mockResolvedValueOnce([
        { id: 5, nombre: "María López", usuarioUphone: "MARIA2026" },
      ]) };

    const response = await listar({
      dashboardFechaDesde: "2026-09-10",
      dashboardFechaHasta: "2026-09-11",
      dashboardUsuarioUphone: " MARIA2026 ",
    });

    const [dashboardSql, dashboardOptions] = UphoneSolicitud.sequelize.query.mock.calls[0];
    expect(dashboardSql).toContain("INVALIDADA_POR_CONTRATO_APROBADO");
    const [vendedoresSql, vendedoresOptions] = UphoneSolicitud.sequelize.query.mock.calls[1];
    expect(vendedoresSql).toContain('LOWER(BTRIM(u."usuarioUphone"))');
    expect(vendedoresSql).toContain("PARTITION BY cliente_clave");
    expect(dashboardOptions.replacements.desde.toISOString())
      .toBe("2026-09-10T05:00:00.000Z");
    expect(dashboardOptions.replacements.hasta.toISOString())
      .toBe("2026-09-12T04:59:59.999Z");
    expect(dashboardOptions.replacements.usuarioUphone).toBe("MARIA2026");
    expect(vendedoresOptions.replacements).toEqual(dashboardOptions.replacements);
    expect(response.dashboard).toMatchObject({
      totalSolicitudes: 2,
      totalAprobadas: 2,
      periodo: {
        fechaDesde: "2026-09-10",
        fechaHasta: "2026-09-11",
        usuarioUphone: "MARIA2026",
      },
      usuarios: [
        { id: 5, nombre: "María López", usuarioUphone: "MARIA2026" },
      ],
      vendedores: [
        expect.objectContaining({
          vendedor: "María López",
          usuarioUphone: "MARIA2026",
          clientes: 2,
          vinculado: true,
        }),
      ],
    });
  });

  test("rechaza un rango invertido", async () => {
    await expect(listar({
      dashboardFechaDesde: "2026-09-12",
      dashboardFechaHasta: "2026-09-10",
    })).rejects.toMatchObject({
      code: "RANGO_FECHAS_INVALIDO",
      statusCode: 400,
    });
  });
});

describe("uphoneSolicitudesService.exportarExcel", () => {
  test("genera un xlsx con todos los resultados de los filtros", async () => {
    UphoneSolicitud.findAll = jest.fn().mockResolvedValue([
      {
        numeroSolicitud: "4795152",
        distribuidor: "AGENCIA NORTE",
        matriz: "MATRIZ",
        vendedor: "VENDEDOR PRUEBA",
        usuario: "USER2026",
        cedula: "0123456789",
        cliente: "CLIENTE PRUEBA",
        telefonoSolicitud: "0999999999",
        telefonoContrato: "S/N",
        fechaSolicitud: new Date("2026-09-28T14:17:01.000Z"),
        fechaContrato: "NO APLICA",
        grupoArrendamiento: "D-PREMIUM DPR",
        estado: "PENDIENTE",
        estadoContrato: "SOLICITUD_APROBADA_AUTOMATICO",
        archivoOrigen: "solicitudes.xlsx",
      },
    ]);

    const result = await exportarExcel({
      estado: " PENDIENTE ",
      usuarioUphone: " USER2026 ",
      fechaDesde: "2026-09-28",
      fechaHasta: "2026-09-29",
    });
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(result.buffer);
    const sheet = workbook.getWorksheet("Solicitudes Uphone");

    expect(result.total).toBe(1);
    expect(result.filename).toMatch(/^solicitudes-uphone-\d{4}-\d{2}-\d{2}\.xlsx$/);
    expect(sheet.getRow(1).values).toContain("USUARIO UPHONE");
    expect(sheet.getRow(2).getCell(1).value).toBe("4795152");
    expect(UphoneSolicitud.findAll).toHaveBeenCalledWith(expect.objectContaining({
      limit: 25001,
      raw: true,
      where: expect.objectContaining({
        estado: expect.any(Object),
        usuario: expect.any(Object),
        fechaSolicitud: expect.any(Object),
      }),
    }));
  });

  test("rechaza un rango invertido antes de consultar la base", async () => {
    UphoneSolicitud.findAll = jest.fn();

    await expect(exportarExcel({
      fechaDesde: "2026-09-30",
      fechaHasta: "2026-09-29",
    })).rejects.toMatchObject({
      code: "RANGO_FECHAS_INVALIDO",
      statusCode: 400,
    });
    expect(UphoneSolicitud.findAll).not.toHaveBeenCalled();
  });
});

describe("uphoneSolicitudesService.eliminarSolicitud", () => {
  test("elimina una solicitud existente y devuelve su identificacion", async () => {
    const destroy = jest.fn().mockResolvedValue(undefined);
    UphoneSolicitud.findByPk = jest.fn().mockResolvedValue({
      id: 14,
      numeroSolicitud: "4795152",
      cliente: "CLIENTE PRUEBA",
      destroy,
    });

    await expect(eliminarSolicitud("14")).resolves.toEqual({
      id: 14,
      numeroSolicitud: "4795152",
      cliente: "CLIENTE PRUEBA",
    });
    expect(UphoneSolicitud.findByPk).toHaveBeenCalledWith(14);
    expect(destroy).toHaveBeenCalledTimes(1);
  });

  test("responde 404 si la solicitud ya no existe", async () => {
    UphoneSolicitud.findByPk = jest.fn().mockResolvedValue(null);

    await expect(eliminarSolicitud("99")).rejects.toMatchObject({
      code: "SOLICITUD_NO_ENCONTRADA",
      statusCode: 404,
    });
  });

  test("rechaza identificadores invalidos sin consultar la base", async () => {
    UphoneSolicitud.findByPk = jest.fn();

    await expect(eliminarSolicitud("abc")).rejects.toMatchObject({
      code: "SOLICITUD_ID_INVALIDO",
      statusCode: 400,
    });
    expect(UphoneSolicitud.findByPk).not.toHaveBeenCalled();
  });
});
