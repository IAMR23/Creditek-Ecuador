const ExcelJS = require("exceljs");
const { Sequelize } = require("sequelize");

// Ejecutar exclusivamente contra una base local temporal con este nombre.
const databaseUrl = process.env.UPHONE_TEST_DATABASE_URL;
const describePostgres = databaseUrl ? describe : describe.skip;
const HEADERS = [
  "DISTRIBUIDOR", "MATRIZ", "VENDEDOR", "NUMERO DE SOLICITUD", "USUARIO",
  "CEDULA", "CLIENTE", "TELEFONO SOLICITUD", "TELEFONO CONTRATO",
  "FECHA SOLICITUD", "FECHA CONTRATO", "GRUPO ARRENDAMIENTO", "ESTADO", "ESTADO CONTRATO",
];
const solicitud = (numero, estadoContrato, overrides = {}) => ({
  numeroSolicitud: numero,
  estadoContrato,
  distribuidor: "AGENCIA NORTE",
  matriz: "MATRIZ",
  vendedor: "VENDEDOR PRUEBA",
  usuario: "USER2026",
  cedula: "0123456789",
  cliente: "CLIENTE PRUEBA",
  telefonoSolicitud: "0999999999",
  telefonoContrato: "0991234567",
  fechaSolicitud: "2026-09-28 09:00:00",
  fechaContrato: estadoContrato === "CONTRATO_APROBADO" ? "2026-09-28 10:00:00" : "NO APLICA",
  grupoArrendamiento: "D-PREMIUM DPR",
  estado: "PENDIENTE",
  ...overrides,
});
const crearArchivo = async (records) => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Uphone");
  sheet.addRow(HEADERS);
  for (const row of records) {
    sheet.addRow([
      row.distribuidor, row.matriz, row.vendedor, row.numeroSolicitud, row.usuario,
      row.cedula, row.cliente, row.telefonoSolicitud, row.telefonoContrato,
      row.fechaSolicitud, row.fechaContrato, row.grupoArrendamiento, row.estado, row.estadoContrato,
    ]);
  }
  return { buffer: Buffer.from(await workbook.xlsx.writeBuffer()), originalname: "prueba.xlsx" };
};
const periodo = {
  dashboardFechaDesde: "2026-09-28",
  dashboardFechaHasta: "2026-09-30",
};

describePostgres("prioridad Uphone con PostgreSQL", () => {
  let sequelize;
  let model;
  let service;
  const importar = async (records) => service.importarExcel({ file: await crearArchivo(records) });

  beforeAll(async () => {
    const url = new URL(databaseUrl);
    if (url.hostname !== "127.0.0.1" || url.pathname !== "/rve_uphone_test"
      || url.username !== "uphone_test") {
      throw new Error("La integracion requiere la base temporal local rve_uphone_test");
    }
    sequelize = new Sequelize(databaseUrl, { logging: false });
    jest.doMock("../config/db", () => ({ sequelize }));
    model = require("../models/UphoneSolicitud");
    service = require("./uphoneSolicitudesService");
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id integer PRIMARY KEY, nombre text, "usuarioUphone" text
      );
      INSERT INTO usuarios VALUES (1, 'Vendedor Norte', 'USER2026'), (2, 'Vendedor Sur', 'OTRO2026')
        ON CONFLICT DO NOTHING;
    `);
    await model.sync();
  });

  beforeEach(async () => {
    await sequelize.query("TRUNCATE uphone_solicitudes RESTART IDENTITY");
  });

  afterAll(async () => {
    if (sequelize) await sequelize.close();
  });

  test.each([
    "SOLICITUD_APROBADA", "SOLICITUD_APROBADA_AUTOMATICO", "SOLICITUD_DENEGADA",
    "SOLICITUD_LLAMADA", "SOLICITUD_LLAMADA_APROBADA", "SOLICITUD_LLAMADA_DENEGADA",
  ])("un contrato posterior reemplaza %s y no retrocede", async (estado) => {
    await importar([solicitud("100", estado)]);
    const result = await importar([solicitud("100", "CONTRATO_APROBADO")]);
    expect(result).toMatchObject({ insertadas: 0, actualizadas: 1, omitidasDuplicadas: 0 });
    expect(await model.count()).toBe(1);
    expect((await model.findOne()).estadoContrato).toBe("CONTRATO_APROBADO");

    const antigua = await importar([solicitud("100", estado)]);
    expect(antigua).toMatchObject({ insertadas: 0, actualizadas: 0, omitidasDuplicadas: 1 });
    expect((await model.findOne()).estadoContrato).toBe("CONTRATO_APROBADO");
  });

  test("reemplaza por cedula/dia aunque cambie el numero de solicitud", async () => {
    await importar([solicitud("100", "SOLICITUD_APROBADA_AUTOMATICO")]);
    const result = await importar([solicitud("101", "CONTRATO_APROBADO", { cedula: "01-234-56789" })]);
    expect(result).toMatchObject({ insertadas: 0, actualizadas: 1, omitidasDuplicadas: 0 });
    expect(await model.count()).toBe(1);
    expect((await model.findOne()).numeroSolicitud).toBe("101");
  });

  test("prioriza el contrato dentro del archivo sin depender del orden de filas", async () => {
    const result = await importar([
      solicitud("100", "SOLICITUD_APROBADA_AUTOMATICO"),
      solicitud("101", "CONTRATO_APROBADO"),
      solicitud("102", "SOLICITUD_LLAMADA_APROBADA"),
    ]);
    expect(result).toMatchObject({ insertadas: 1, actualizadas: 0, omitidasDuplicadas: 2 });
    expect((await model.findOne()).numeroSolicitud).toBe("101");
    expect(await importar([solicitud("101", "CONTRATO_APROBADO")]))
      .toMatchObject({ insertadas: 0, actualizadas: 0, omitidasDuplicadas: 1 });
  });

  test("tabla, dashboard, vendedores y exportacion solo cuentan el contrato entre fechas/agencias", async () => {
    await importar([
      solicitud("100", "SOLICITUD_APROBADA_AUTOMATICO"),
      solicitud("101", "SOLICITUD_DENEGADA", { fechaSolicitud: "2026-09-29 09:00:00" }),
      solicitud("102", "CONTRATO_APROBADO", {
        fechaSolicitud: "2026-09-30 09:00:00", distribuidor: "AGENCIA SUR", usuario: "OTRO2026",
      }),
    ]);
    const result = await service.listar(periodo);
    expect(await model.count()).toBe(3);
    expect(result.solicitudes.map((row) => row.numeroSolicitud)).toEqual(["102"]);
    expect(result.resumen).toEqual({ totalRegistradas: 1, totalFiltradas: 1 });
    expect(result.dashboard).toMatchObject({
      totalSolicitudes: 1, totalAprobadas: 1, totalConcretadas: 1,
      totalDenegadas: 0, totalInvalidadas: 0,
      vendedores: [expect.objectContaining({ usuarioUphone: "OTRO2026", clientes: 1, concretadas: 1 })],
      telefonos099999: { cantidad: 1, total: 1, porcentaje: 100 },
    });
    const anterior = await service.listar({
      ...periodo, agencia: "AGENCIA NORTE", usuariosUphone: "USER2026",
      dashboardAgencia: "AGENCIA NORTE", dashboardUsuariosUphone: "USER2026",
    });
    expect(anterior.solicitudes).toHaveLength(0);
    expect(anterior.dashboard.totalSolicitudes).toBe(0);
    expect(anterior.dashboard.vendedores).toHaveLength(0);
    expect(anterior.dashboard.telefonos099999.total).toBe(0);
    expect((await service.listar({ ...periodo, fechaHasta: "2026-09-29" })).solicitudes).toHaveLength(0);
    const excel = await service.exportarExcel({});
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(excel.buffer);
    expect(excel.total).toBe(1);
    expect(workbook.worksheets[0].getRow(2).getCell(1).value).toBe("102");
  });

  test("sin contrato aprobado conserva las solicitudes de fechas distintas", async () => {
    await importar([
      solicitud("100", "SOLICITUD_APROBADA_AUTOMATICO"),
      solicitud("101", "SOLICITUD_LLAMADA_APROBADA", { fechaSolicitud: "2026-09-29 09:00:00" }),
    ]);
    const result = await service.listar(periodo);
    expect(result.solicitudes).toHaveLength(2);
    expect(result.dashboard.totalSolicitudes).toBe(2);
    expect(result.dashboard.totalConcretadas).toBe(0);
  });

  test("entre varios contratos aprobados conserva el mas reciente", async () => {
    await importar([
      solicitud("100", "CONTRATO_APROBADO"),
      solicitud("101", "CONTRATO_APROBADO", { fechaSolicitud: "2026-09-29 09:00:00" }),
      solicitud("102", "SOLICITUD_LLAMADA", { fechaSolicitud: "2026-09-30 09:00:00" }),
    ]);
    const result = await service.listar(periodo);
    expect(result.solicitudes.map((row) => row.numeroSolicitud)).toEqual(["101"]);
    expect(result.dashboard.totalSolicitudes).toBe(1);
  });

  test("una escritura fallida revierte tambien la promocion del contrato", async () => {
    await importar([solicitud("100", "SOLICITUD_APROBADA_AUTOMATICO")]);
    const write = jest.spyOn(model, "bulkCreate").mockRejectedValueOnce(new Error("fallo de prueba"));
    try {
      await expect(importar([
        solicitud("100", "CONTRATO_APROBADO"),
        solicitud("101", "SOLICITUD_LLAMADA", { cedula: "0987654321" }),
      ])).rejects.toThrow("fallo de prueba");
    } finally {
      write.mockRestore();
    }
    expect(await model.count()).toBe(1);
    expect((await model.findOne()).estadoContrato).toBe("SOLICITUD_APROBADA_AUTOMATICO");
  });

  test("no une clientes sin cedula utilizable", async () => {
    await importar([
      solicitud("100", "SOLICITUD_APROBADA_AUTOMATICO", { cedula: "SIN CEDULA" }),
      solicitud("101", "CONTRATO_APROBADO", { cedula: "SIN CEDULA" }),
    ]);
    expect((await service.listar(periodo)).solicitudes).toHaveLength(2);
  });

  test("reconoce un contrato historico aunque su llave normalizada sea nula", async () => {
    await importar([solicitud("100", "SOLICITUD_APROBADA_AUTOMATICO")]);
    const anterior = await model.findOne();
    await model.create({
      ...anterior.get({ plain: true }), id: undefined, numeroSolicitud: "101",
      cedulaNormalizada: null, estadoContrato: "CONTRATO_APROBADO",
    });
    expect((await service.listar(periodo)).solicitudes.map((row) => row.numeroSolicitud)).toEqual(["101"]);
    expect(await importar([solicitud("101", "CONTRATO_APROBADO")]))
      .toMatchObject({ insertadas: 0, actualizadas: 0, omitidasDuplicadas: 1 });
  });

  test("actualiza historicos duplicados sin violar la llave unica de cedula/dia", async () => {
    await importar([solicitud("100", "SOLICITUD_APROBADA_AUTOMATICO")]);
    const anterior = await model.findOne();
    await model.create({
      ...anterior.get({ plain: true }), id: undefined, numeroSolicitud: "101", cedulaNormalizada: null,
    });
    expect(await importar([solicitud("101", "CONTRATO_APROBADO")]))
      .toMatchObject({ insertadas: 0, actualizadas: 1, omitidasDuplicadas: 0 });
    expect((await service.listar(periodo)).solicitudes.map((row) => row.numeroSolicitud)).toEqual(["101"]);
    expect(await model.count()).toBe(2);
  });

  test("cargas simultaneas conservan el contrato aprobado", async () => {
    await Promise.all([
      importar([solicitud("100", "SOLICITUD_APROBADA_AUTOMATICO")]),
      importar([solicitud("101", "CONTRATO_APROBADO")]),
    ]);
    expect(await model.count()).toBe(1);
    expect((await model.findOne()).estadoContrato).toBe("CONTRATO_APROBADO");
  });
});
