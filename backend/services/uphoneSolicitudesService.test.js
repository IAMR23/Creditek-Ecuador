const ExcelJS = require("exceljs");
const { Op } = require("sequelize");

jest.mock("../models/UphoneSolicitud", () => ({}));

const UphoneSolicitud = require("../models/UphoneSolicitud");
const {
  crearDashboard,
  crearCatalogoAgenciasUphone,
  crearCatalogoUsuariosUphone,
  crearResumenVendedores,
  crearResumenTelefonos099999,
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
  beforeEach(() => {
    UphoneSolicitud.sequelize = {
      transaction: jest.fn(async (callback) => callback({ id: "importacion" })),
      query: jest.fn().mockResolvedValue([]),
    };
    UphoneSolicitud.bulkCreate = jest.fn(async (rows) =>
      rows.map((item, index) => ({ ...item, id: index + 1 })));
  });

  test("lee el formato real y normaliza el numero de solicitud", async () => {
    const parsed = await parsearExcel(await crearExcel());

    expect(parsed.sheetName).toBe("ReportUphone1");
    expect(parsed.records).toHaveLength(1);
    expect(parsed.records[0]).toMatchObject({
      numeroSolicitud: "4795152",
      vendedor: "VENDEDOR PRUEBA",
      cedula: "0123456789",
      cedulaNormalizada: "0123456789",
      fechaSolicitudDia: "2026-09-28",
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

  test("conserva la misma cedula cuando aparece en un dia posterior", async () => {
    UphoneSolicitud.bulkCreate = jest.fn(async (rows) =>
      rows.map((item, index) => ({ ...item, id: index + 1 })));
    const siguienteDia = [...BASE_ROW];
    siguienteDia[3] = 4795153;
    siguienteDia[6] = "CLIENTE DEL SIGUIENTE DIA";
    siguienteDia[9] = new Date("2026-09-29T09:17:01.000Z");

    const result = await importarExcel({
      file: {
        buffer: await crearExcel(HEADERS, [siguienteDia]),
        originalname: "solicitudes.xlsx",
      },
      usuarioId: 8,
    });

    expect(UphoneSolicitud.bulkCreate).toHaveBeenCalledWith([
      expect.objectContaining({
        numeroSolicitud: "4795152",
        cedulaNormalizada: "0123456789",
        fechaSolicitudDia: "2026-09-28",
      }),
      expect.objectContaining({
        numeroSolicitud: "4795153",
        cedulaNormalizada: "0123456789",
        fechaSolicitudDia: "2026-09-29",
      }),
    ], expect.objectContaining({ ignoreDuplicates: true }));
    expect(result).toMatchObject({ insertadas: 2, omitidasDuplicadas: 0 });
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

  test.each([4795152, 4795153])(
    "prioriza CONTRATO_APROBADO sobre aprobacion automatica para la solicitud %s",
    async (numeroSolicitud) => {
      const contrato = [...BASE_ROW];
      contrato[3] = numeroSolicitud;
      contrato[13] = "CONTRATO_APROBADO";
      const result = await importarExcel({
        file: { buffer: await crearExcel(HEADERS, [contrato]), originalname: "uphone.xlsx" },
      });

      expect(UphoneSolicitud.bulkCreate).toHaveBeenCalledWith([
        expect.objectContaining({
          numeroSolicitud: String(numeroSolicitud),
          estadoContrato: "CONTRATO_APROBADO",
        }),
      ], expect.objectContaining({ ignoreDuplicates: true, transaction: expect.any(Object) }));
      expect(result).toMatchObject({ insertadas: 1, actualizadas: 0, omitidasDuplicadas: 1 });
    },
  );

  test.each([4795152, 4795153])(
    "actualiza una solicitud guardada cuando llega contrato aprobado con numero %s",
    async (numeroSolicitud) => {
      UphoneSolicitud.sequelize.query
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{
          id: "15",
          numeroSolicitud: "4795152",
          cedula: "0123456789",
          cedulaNormalizada: "0123456789",
          fechaSolicitudDia: "2026-09-28",
          estadoContrato: "SOLICITUD_APROBADA_AUTOMATICO",
        }])
        .mockResolvedValueOnce([[{ id: "15" }], {}]);
      const contrato = [...BASE_ROW];
      contrato[3] = numeroSolicitud;
      contrato[5] = "01-234-56789";
      contrato[13] = " contrato aprobado ";
      const result = await importarExcel({
        file: { buffer: await crearExcel(HEADERS, [contrato]), originalname: "uphone.xlsx" },
        usuarioId: 8,
      });

      const [sql, options] = UphoneSolicitud.sequelize.query.mock.calls[2];
      expect(sql).toContain("UPDATE uphone_solicitudes");
      expect(JSON.parse(options.replacements.records)).toEqual([
        expect.objectContaining({
          id: "15",
          numeroSolicitud: String(numeroSolicitud),
          estadoContrato: "contrato aprobado",
          cedulaNormalizada: "0123456789",
          importadoPorId: 8,
        }),
      ]);
      expect(UphoneSolicitud.bulkCreate).not.toHaveBeenCalled();
      expect(result).toMatchObject({ insertadas: 0, actualizadas: 1, omitidasDuplicadas: 1 });
    },
  );

  test("no reemplaza un contrato ya aprobado al cargar nuevamente el archivo", async () => {
    UphoneSolicitud.sequelize.query
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{
        id: "15",
        numeroSolicitud: "4795152",
        cedula: "0123456789",
        cedulaNormalizada: "0123456789",
        fechaSolicitudDia: "2026-09-28",
        estadoContrato: "CONTRATO_APROBADO",
      }]);
    const contrato = [...BASE_ROW];
    contrato[13] = "CONTRATO_APROBADO";
    const result = await importarExcel({
      file: { buffer: await crearExcel(HEADERS, [contrato]), originalname: "uphone.xlsx" },
    });

    expect(UphoneSolicitud.bulkCreate).not.toHaveBeenCalled();
    expect(result).toMatchObject({ insertadas: 0, actualizadas: 0, omitidasDuplicadas: 2 });
  });

  test("revierte toda la importacion si falla una actualizacion", async () => {
    const error = new Error("error de PostgreSQL");
    UphoneSolicitud.sequelize.query
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{
        id: "15", numeroSolicitud: "4795152", estadoContrato: "SOLICITUD_APROBADA_AUTOMATICO",
      }])
      .mockRejectedValueOnce(error);
    const contrato = [...BASE_ROW];
    contrato[13] = "CONTRATO_APROBADO";
    await expect(importarExcel({
      file: { buffer: await crearExcel(HEADERS, [contrato]), originalname: "uphone.xlsx" },
      requestId: "prueba-importacion",
    })).rejects.toMatchObject({
      uphoneStage: "insertar_postgresql",
      uphoneChunk: { index: 1, rows: 1, requestId: "prueba-importacion" },
    });
    expect(UphoneSolicitud.bulkCreate).not.toHaveBeenCalled();
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
        concretadas: "2",
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
      totalConcretadas: 2,
      totalDenegadas: 3,
      totalOtros: 0,
      agenciaLider: {
        agencia: "AGENCIA NORTE",
        total: 5,
        aprobadas: 3,
        concretadas: 2,
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
        aprobadas: "3",
        concretadas: "2",
        denegadas: "2",
        otros: "2",
      },
      {
        usuarioId: null,
        vendedor: "SINMAPEO",
        usuarioUphone: "SINMAPEO",
        vinculado: false,
        clientes: "2",
        aprobadas: "0",
        concretadas: "0",
        denegadas: "1",
        otros: "1",
      },
    ])).toEqual([
      {
        usuarioId: 12,
        vendedor: "Andrea Pérez",
        usuarioUphone: "ARI2028",
        vinculado: true,
        clientes: 7,
        aprobadas: 3,
        concretadas: 2,
        denegadas: 2,
        otros: 2,
      },
      {
        usuarioId: null,
        vendedor: "SINMAPEO",
        usuarioUphone: "SINMAPEO",
        vinculado: false,
        clientes: 2,
        aprobadas: 0,
        concretadas: 0,
        denegadas: 1,
        otros: 1,
      },
    ]);
  });
});

describe("uphoneSolicitudesService.crearResumenTelefonos099999", () => {
  test("calcula el porcentaje general, por agencia y por vendedor", () => {
    const resumen = crearResumenTelefonos099999([
      {
        dimension: "agencia",
        nombre: "Agencia Norte",
        total: "10",
        cantidad: "2",
      },
      {
        dimension: "vendedor",
        nombre: "Raúl",
        usuarioUphone: "PABLO2027",
        usuarioId: "44",
        vinculado: true,
        total: "5",
        cantidad: "2",
      },
    ], 10);

    expect(resumen).toMatchObject({
      patron: "099999*",
      cantidad: 2,
      total: 10,
      porcentaje: 20,
      agencias: [
        expect.objectContaining({
          nombre: "AGENCIA NORTE",
          total: 10,
          cantidad: 2,
          porcentaje: 20,
        }),
      ],
      vendedores: [
        expect.objectContaining({
          nombre: "Raúl",
          usuarioUphone: "PABLO2027",
          usuarioId: 44,
          porcentaje: 40,
        }),
      ],
    });
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

describe("uphoneSolicitudesService.crearCatalogoAgenciasUphone", () => {
  test("normaliza y omite agencias vacias", () => {
    expect(crearCatalogoAgenciasUphone([
      { agencia: " Agencia Norte " },
      { agencia: null },
      { agencia: "Matriz" },
    ])).toEqual(["Agencia Norte", "Matriz"]);
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
          concretadas: "1",
        },
      ])
      .mockResolvedValueOnce([
        {
          usuarioId: 5,
          vendedor: "María López",
          usuarioUphone: "MARIA2026",
          vinculado: true,
          clientes: "2",
          aprobadas: "1",
          concretadas: "1",
          denegadas: "1",
          otros: "0",
        },
      ])
      .mockResolvedValueOnce([
        {
          dimension: "agencia",
          nombre: "Agencia Centro",
          usuarioUphone: null,
          usuarioId: null,
          vinculado: false,
          total: "2",
          cantidad: "1",
        },
        {
          dimension: "vendedor",
          nombre: "María López",
          usuarioUphone: "MARIA2026",
          usuarioId: 5,
          vinculado: true,
          total: "2",
          cantidad: "1",
        },
      ])
      .mockResolvedValueOnce([
        { id: 5, nombre: "María López", usuarioUphone: "MARIA2026" },
        { id: 8, nombre: "Juan Pérez", usuarioUphone: "JUAN2026" },
      ])
      .mockResolvedValueOnce([
        { agencia: "AGENCIA CENTRO" },
        { agencia: "AGENCIA NORTE" },
      ]) };

    const response = await listar({
      dashboardFechaDesde: "2026-09-10",
      dashboardFechaHasta: "2026-09-11",
      dashboardUsuariosUphone: " MARIA2026 , JUAN2026 ",
      dashboardAgencia: " AGENCIA CENTRO ",
    });

    const [dashboardSql, dashboardOptions] = UphoneSolicitud.sequelize.query.mock.calls[0];
    expect(dashboardSql).toContain("FROM solicitudes_vigentes");
    expect(dashboardSql).toContain("= 'CONTRATO_APROBADO'");
    expect(dashboardSql).toMatch(/PARTITION BY cliente_clave\s*\)/);
    expect(dashboardSql).toContain("AS concretadas");
    const [vendedoresSql, vendedoresOptions] = UphoneSolicitud.sequelize.query.mock.calls[1];
    expect(vendedoresSql).toContain('LOWER(BTRIM(u."usuarioUphone"))');
    expect(vendedoresSql).toMatch(
      /PARTITION BY\s+cliente_clave,\s+\("fechaSolicitud"/,
    );
    expect(vendedoresSql).toContain("AT TIME ZONE 'America/Guayaquil'");
    expect(vendedoresSql).toContain("FILTER (WHERE s.resultado = 'aprobadas')");
    expect(vendedoresSql).toContain("FILTER (WHERE s.resultado = 'denegadas')");
    expect(vendedoresSql).toContain("s.resultado = 'aprobadas' AND s.concretada");
    expect(dashboardOptions.replacements.desde.toISOString())
      .toBe("2026-09-10T05:00:00.000Z");
    expect(dashboardOptions.replacements.hasta.toISOString())
      .toBe("2026-09-12T04:59:59.999Z");
    expect(dashboardOptions.replacements).toMatchObject({
      filtrarUsuarios: true,
      usuariosUphone: ["maria2026", "juan2026"],
      agencia: "AGENCIA CENTRO",
    });
    expect(vendedoresOptions.replacements).toEqual(dashboardOptions.replacements);
    const [telefonosSql, telefonosOptions] = UphoneSolicitud.sequelize.query.mock.calls[2];
    expect(telefonosSql).toContain("LIKE '099999%'");
    expect(telefonosSql).toContain('LOWER(BTRIM(u."usuarioUphone"))');
    expect(telefonosOptions.replacements).toEqual(dashboardOptions.replacements);
    expect(response.dashboard).toMatchObject({
      totalSolicitudes: 2,
      totalAprobadas: 2,
      totalConcretadas: 1,
      periodo: {
        fechaDesde: "2026-09-10",
        fechaHasta: "2026-09-11",
        usuariosUphone: ["MARIA2026", "JUAN2026"],
        agencia: "AGENCIA CENTRO",
      },
      usuarios: [
        { id: 5, nombre: "María López", usuarioUphone: "MARIA2026" },
        { id: 8, nombre: "Juan Pérez", usuarioUphone: "JUAN2026" },
      ],
      agenciasDisponibles: ["AGENCIA CENTRO", "AGENCIA NORTE"],
      vendedores: [
        expect.objectContaining({
          vendedor: "María López",
          usuarioUphone: "MARIA2026",
          clientes: 2,
          aprobadas: 1,
          concretadas: 1,
          denegadas: 1,
          otros: 0,
          vinculado: true,
        }),
      ],
      telefonos099999: {
        patron: "099999*",
        cantidad: 1,
        total: 2,
        porcentaje: 50,
        agencias: [
          expect.objectContaining({ nombre: "AGENCIA CENTRO", porcentaje: 50 }),
        ],
        vendedores: [
          expect.objectContaining({
            nombre: "María López",
            usuarioUphone: "MARIA2026",
            porcentaje: 50,
          }),
        ],
      },
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
      usuariosUphone: " USER2026,OTRO2026 ",
      agencia: " AGENCIA NORTE ",
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
        fechaSolicitud: expect.any(Object),
      }),
    }));
    const exportWhere = UphoneSolicitud.findAll.mock.calls[0][0].where;
    expect(exportWhere[Op.and]).toHaveLength(2);
    expect(exportWhere[Op.and][0][Op.or]).toHaveLength(2);
    expect(exportWhere[Op.and][1][Op.or]).toHaveLength(2);
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
