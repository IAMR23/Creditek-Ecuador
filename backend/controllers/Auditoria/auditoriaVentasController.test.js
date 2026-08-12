jest.mock("../../models/ConciliacionModeloTv", () => ({
  findOne: jest.fn(),
}));

jest.mock("../../models/ConciliacionModeloCelular", () => ({
  findOne: jest.fn(),
}));

jest.mock("../../models/DetalleVenta", () => ({
  update: jest.fn(),
}));

jest.mock("../../services/auditoriaVentasPdfService", () => ({
  auditarVentasDesdeDirectorio: jest.fn(),
  auditarVentasDesdeRegistros: jest.fn(),
}));

jest.mock("../../services/auditoriaVentasPersistenciaService", () => ({
  actualizarComentarioResultadoAuditoriaVentasPdf: jest.fn(),
  guardarAuditoriaVentasPdf: jest.fn(),
  obtenerAuditoriaVentasPdfPorId: jest.fn(),
  obtenerAuditoriaVentasPdfPrecargada: jest.fn(),
}));

jest.mock("../../services/controlFinancieroAuditoriaService", () => ({
  obtenerRegistrosAuditoriaDesdeControlFinanciero: jest.fn(),
}));

const ConciliacionModeloTv = require("../../models/ConciliacionModeloTv");
const ConciliacionModeloCelular = require("../../models/ConciliacionModeloCelular");
const DetalleVenta = require("../../models/DetalleVenta");
const Task = require("../../models/Task");
const Usuario = require("../../models/Usuario");
const Venta = require("../../models/Venta");
const {
  auditarVentasDesdeDirectorio,
  auditarVentasDesdeRegistros,
} = require("../../services/auditoriaVentasPdfService");
const {
  actualizarComentarioResultadoAuditoriaVentasPdf,
  guardarAuditoriaVentasPdf,
  obtenerAuditoriaVentasPdfPorId,
  obtenerAuditoriaVentasPdfPrecargada,
} = require("../../services/auditoriaVentasPersistenciaService");
const {
  obtenerRegistrosAuditoriaDesdeControlFinanciero,
} = require("../../services/controlFinancieroAuditoriaService");
const controller = require("./auditoriaVentasController");

const crearVentaTv = ({ ventaId, detalleId, contrato = "CONTRATO" }) => ({
  id: ventaId,
  fecha: "2026-07-16",
  activo: true,
  cliente: {
    cliente: "MISMO CLIENTE",
    cedula: "",
  },
  usuarioAgencia: {
    agencia: { nombre: "AGENCIA" },
    usuario: { nombre: "VENDEDOR" },
  },
  origen: { nombre: "ORIGEN" },
  detalleVenta: [
    {
      id: detalleId,
      modeloId: 71,
      modelo: { nombre: "TV 32 PULG" },
      dispositivoMarca: {
        dispositivo: { nombre: "TV" },
        marca: { nombre: "ZITRO" },
      },
      formaPagoId: 1,
      formaPago: { nombre: "CREDITO" },
      precioUnitario: 100,
      precioVenta: 100,
      precioVendedor: 100,
      entrada: 10,
      cierreCaja: "CREDITV",
      contrato,
      referenciaPdf: "",
    },
  ],
});

const crearRegistroPdfTv = ({ factura, fecha }) => ({
  origen: "PDF_CREDITV",
  factura,
  fecha,
  cliente: "MISMO CLIENTE",
  codigo_pdf: "LA32ZEC",
  modelo_normalizado: "ZITRO 32",
  valor_ventas: 100,
  valor_ventas_detectado: true,
  precio_vendedor_detectado: true,
  entrada: 10,
  entrada_detectada: true,
});

const crearVentaCelular = () => ({
  ...crearVentaTv({ ventaId: 3801, detalleId: 3677 }),
  detalleVenta: [
    {
      ...crearVentaTv({ ventaId: 3801, detalleId: 3677 }).detalleVenta[0],
      id: 3677,
      modeloId: 72,
      modelo: { nombre: "CELULAR PRUEBA" },
      dispositivoMarca: {
        dispositivo: { nombre: "CELULAR" },
        marca: { nombre: "MARCA" },
      },
    },
  ],
});

describe("auditarRegistrosPdf", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    ConciliacionModeloTv.findOne.mockResolvedValue({
      modeloRveId: 71,
      modeloRveNombre: "TV 32 PULG",
    });
    ConciliacionModeloCelular.findOne.mockResolvedValue({
      modeloRveId: 72,
      modeloRveNombre: "CELULAR PRUEBA",
    });
    DetalleVenta.update.mockResolvedValue([1]);
  });

  it("asigna dos filas TV equivalentes a dos detalles RVE distintos", async () => {
    const ventas = [
      crearVentaTv({ ventaId: 3799, detalleId: 3675 }),
      crearVentaTv({ ventaId: 3800, detalleId: 3676 }),
    ];
    const registrosPdf = [
      crearRegistroPdfTv({ factura: "PDF-1", fecha: "7/16/26 8:02 PM" }),
      crearRegistroPdfTv({ factura: "PDF-2", fecha: "7/16/26 8:21 PM" }),
    ];

    const auditoria = await controller.auditarRegistrosPdf({
      tipo: "TV",
      registrosPdf,
      ventas,
    });

    expect(auditoria.resultados).toHaveLength(2);
    expect(
      auditoria.resultados.map((fila) => [
        fila.detalleVentaId,
        fila.observacionError,
      ]),
    ).toEqual([
      [3675, "OK"],
      [3676, "OK"],
    ]);
    expect(DetalleVenta.update).toHaveBeenNthCalledWith(
      1,
      { referenciaPdf: "LA32ZEC", contrato: "PDF-1" },
      { where: { id: 3675 } },
    );
    expect(DetalleVenta.update).toHaveBeenNthCalledWith(
      2,
      { referenciaPdf: "LA32ZEC", contrato: "PDF-2" },
      { where: { id: 3676 } },
    );
    expect(auditoria.resultados.map((fila) => fila.contrato)).toEqual([
      "PDF-1",
      "PDF-2",
    ]);
  });

  it("usa el contrato para asociar cada PDF con su detalle correcto", async () => {
    const ventas = [
      crearVentaTv({
        ventaId: 3799,
        detalleId: 3675,
        contrato: "TV-001",
      }),
      crearVentaTv({
        ventaId: 3800,
        detalleId: 3676,
        contrato: "TV-002",
      }),
    ];
    const registrosPdf = [
      crearRegistroPdfTv({ factura: "TV-002", fecha: "7/16/26 8:02 PM" }),
      crearRegistroPdfTv({ factura: "TV-001", fecha: "7/16/26 8:21 PM" }),
    ];

    const auditoria = await controller.auditarRegistrosPdf({
      tipo: "TV",
      registrosPdf,
      ventas,
    });

    expect(DetalleVenta.update).toHaveBeenNthCalledWith(
      1,
      { referenciaPdf: "LA32ZEC", contrato: "TV-002" },
      { where: { id: 3676 } },
    );
    expect(DetalleVenta.update).toHaveBeenNthCalledWith(
      2,
      { referenciaPdf: "LA32ZEC", contrato: "TV-001" },
      { where: { id: 3675 } },
    );
    expect(
      auditoria.resultados.map((fila) => [
        fila.detalleVentaId,
        fila.contrato,
      ]),
    ).toEqual([
      [3675, "TV-001"],
      [3676, "TV-002"],
    ]);
  });

  it("no marca celulares como faltantes al auditar un PDF de TV", async () => {
    const ventas = [
      crearVentaTv({ ventaId: 3799, detalleId: 3675 }),
      crearVentaCelular(),
    ];

    const auditoria = await controller.auditarRegistrosPdf({
      tipo: "TV",
      registrosPdf: [
        crearRegistroPdfTv({ factura: "PDF-1", fecha: "7/16/26 8:02 PM" }),
      ],
      ventas,
    });

    expect(auditoria.resultados).toHaveLength(1);
    expect(auditoria.resultados[0]).toEqual(
      expect.objectContaining({ detalleVentaId: 3675, observacionError: "OK" }),
    );
  });

  it("asocia el contrato y el IMEI del PDF de celular con la venta", async () => {
    const ventaCelular = crearVentaCelular();
    ventaCelular.detalleVenta[0].contrato = "";

    const auditoria = await controller.auditarRegistrosPdf({
      tipo: "CELULAR",
      registrosPdf: [
        {
          factura: "CEL-9001",
          fecha: "7/16/26 8:02 PM",
          cliente: "MISMO CLIENTE",
          codigo_pdf: "CELULAR PRUEBA",
          modelo_normalizado: "CELULAR PRUEBA",
          imei: "123456789012345",
          valor_ventas: 100,
          valor_ventas_detectado: true,
          precio_vendedor_detectado: true,
          entrada: 10,
          entrada_detectada: true,
        },
      ],
      ventas: [ventaCelular],
    });

    expect(DetalleVenta.update).toHaveBeenCalledWith(
      {
        referenciaPdf: "123456789012345",
        contrato: "CEL-9001",
      },
      { where: { id: 3677 } },
    );
    expect(auditoria.resultados[0]).toEqual(
      expect.objectContaining({
        detalleVentaId: 3677,
        contrato: "CEL-9001",
        referenciaPdf: "123456789012345",
      }),
    );
  });
});

describe("auditarVentasDesdePdf", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("conserva la respuesta del endpoint manual usando el servicio comun", async () => {
    const resultado = {
      ok: true,
      tipo: "TV",
      resumen: {
        pdfsProcesados: 1,
        registrosPdf: 2,
        registrosPdfValidos: 2,
        dispositivosCreditoPdf: 2,
        dispositivosCreditoRve: 2,
        diferenciaCredito: 0,
        criterioCreditoRve: "formaPago credito",
        ventasComparadas: 2,
        erroresDetectados: 0,
        erroresExtraccion: 0,
      },
      ventas: [],
      errores: [],
    };
    auditarVentasDesdeDirectorio.mockResolvedValue(resultado);
    const req = {
      body: {
        tipo: "tv",
        fechaInicio: "2026-07-25",
        fechaFin: "2026-07-25",
        agenciaId: "4",
      },
      files: [{ originalname: "venta-tv.pdf" }],
      user: { id: 7 },
      app: { get: jest.fn() },
      auditoriaTempRoot: "C:/temp/auditoria-manual-test",
      auditoriaInputDir: "C:/temp/auditoria-manual-test/input",
    };
    const res = {
      json: jest.fn(),
      status: jest.fn(),
    };
    res.status.mockReturnValue(res);

    await controller.auditarVentasDesdePdf(req, res);

    expect(auditarVentasDesdeDirectorio).toHaveBeenCalledWith(
      expect.objectContaining({
        tipo: "TV",
        fechaInicio: "2026-07-25",
        fechaFin: "2026-07-25",
        usuarioId: 7,
        filtros: expect.objectContaining({ agenciaId: "4" }),
        persistirAuditoriaVentasPdf: guardarAuditoriaVentasPdf,
      }),
    );
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(resultado);
  });

  test("devuelve una auditoria automatica precargada sin exponer registros internos", async () => {
    obtenerRegistrosAuditoriaDesdeControlFinanciero.mockResolvedValue({
      tipo: "TV",
      fechaInicio: "2026-07-25",
      fechaFin: "2026-07-25",
      cargaIds: [25],
      registrosPdf: [{ factura: "TV-1" }],
      totalRegistrosPdf: 1,
      pdfsProcesados: 1,
    });
    obtenerAuditoriaVentasPdfPrecargada.mockResolvedValue({
      id: 51,
      tipo: "TV",
      fechaInicio: "2026-07-25",
      fechaFin: "2026-07-25",
      origen: "CAJA",
      estado: "COMPLETADA_CON_INCONSISTENCIAS",
      registrosPdf: [{ factura: "INTERNO" }],
      resultados: [{ detalleVentaId: 10, observacionError: "NO_EN_PDF" }],
      resumen: { erroresDetectados: 1 },
      errores: [],
      updatedAt: "2026-07-25T20:00:00.000Z",
    });
    const req = {
      query: {
        tipo: "TV",
        fechaInicio: "2026-07-25",
        fechaFin: "2026-07-25",
      },
    };
    const res = { json: jest.fn(), status: jest.fn() };
    res.status.mockReturnValue(res);

    await controller.obtenerAuditoriaPdfPrecargada(req, res);

    expect(res.json).toHaveBeenCalledWith({
      ok: true,
      auditoria: expect.objectContaining({
        id: 51,
        origen: "CAJA",
        ventas: [{ detalleVentaId: 10, observacionError: "NO_EN_PDF" }],
        fuenteControlFinanciero: {
          cargaIds: [25],
          registros: 1,
          archivos: 1,
        },
      }),
    });
    expect(res.json.mock.calls[0][0].auditoria).not.toHaveProperty(
      "registrosPdf",
    );
  });

  test("reaudita desde la carga de Control financiero de la fecha seleccionada", async () => {
    const registrosPdf = [{ factura: "TV-DIA-3" }];
    obtenerRegistrosAuditoriaDesdeControlFinanciero.mockResolvedValue({
      tipo: "TV",
      fechaInicio: "2026-08-03",
      fechaFin: "2026-08-03",
      cargaIds: [33],
      registrosPdf,
      totalRegistrosPdf: 1,
      pdfsProcesados: 1,
    });
    obtenerAuditoriaVentasPdfPrecargada.mockResolvedValue({ id: 70 });
    const resultado = {
      ok: true,
      tipo: "TV",
      resumen: { registrosPdf: 1, erroresDetectados: 1 },
      ventas: [{ observacionError: "NO_EN_PDF" }],
      errores: [],
    };
    auditarVentasDesdeRegistros.mockResolvedValue(resultado);
    const req = {
      body: {
        tipo: "TV",
        fechaInicio: "2026-08-03",
        fechaFin: "2026-08-03",
      },
      user: { id: 7 },
      app: { get: jest.fn() },
    };
    const res = { json: jest.fn(), status: jest.fn() };
    res.status.mockReturnValue(res);

    await controller.reauditarVentasDesdeControlFinanciero(req, res);

    expect(
      obtenerRegistrosAuditoriaDesdeControlFinanciero,
    ).toHaveBeenCalledWith({
      tipo: "TV",
      fechaInicio: "2026-08-03",
      fechaFin: "2026-08-03",
    });
    expect(auditarVentasDesdeRegistros).toHaveBeenCalledWith(
      expect.objectContaining({
        auditoriaId: 70,
        registrosPdf,
        fechaInicio: "2026-08-03",
        fechaFin: "2026-08-03",
        controlFinancieroCargaId: 33,
      }),
    );
    expect(res.json).toHaveBeenCalledWith(resultado);
  });

  test("reaudita los registros persistidos sin necesitar archivos PDF", async () => {
    obtenerAuditoriaVentasPdfPorId.mockResolvedValue({
      id: 52,
      tipo: "CELULAR",
      fechaInicio: "2026-07-25",
      fechaFin: "2026-07-25",
      origen: "CAJA",
      controlFinancieroCargaId: 25,
      registrosPdf: [{ imei: "123" }],
      resultados: [],
      resumen: { registrosPdf: 1, pdfsProcesados: 1 },
      errores: [],
    });
    const resultado = {
      ok: true,
      tipo: "CELULAR",
      resumen: { registrosPdf: 1, erroresDetectados: 0 },
      ventas: [],
      errores: [],
    };
    auditarVentasDesdeRegistros.mockResolvedValue(resultado);
    const req = {
      params: { auditoriaId: "52" },
      body: { agenciaId: "4" },
      user: { id: 7 },
      app: { get: jest.fn() },
    };
    const res = { json: jest.fn(), status: jest.fn() };
    res.status.mockReturnValue(res);

    await controller.reauditarVentasDesdePrecarga(req, res);

    expect(auditarVentasDesdeRegistros).toHaveBeenCalledWith(
      expect.objectContaining({
        auditoriaId: 52,
        tipo: "CELULAR",
        registrosPdf: [{ imei: "123" }],
        controlFinancieroCargaId: 25,
        filtros: expect.objectContaining({ agenciaId: "4" }),
        persistirAuditoriaVentasPdf: guardarAuditoriaVentasPdf,
      }),
    );
    expect(res.json).toHaveBeenCalledWith(resultado);
  });
});

describe("notificarDiferenciasPrecioAuditoria", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("no crea tareas duplicadas cuando ya existe la tarea del detalle", async () => {
    jest.spyOn(Usuario, "findAll").mockResolvedValue([
      {
        id: 15,
        rol: { nombre: "ADMINISTRADOR" },
        roles: [],
      },
    ]);
    const tareaExistente = { id: 99, assignedTo: 15 };
    const findOne = jest.spyOn(Task, "findOne").mockResolvedValue(tareaExistente);
    const create = jest.spyOn(Task, "create").mockResolvedValue({ id: 100 });
    const filas = [
      {
        id: 20,
        detalleVentaId: 30,
        activo: true,
        vendedor: "VENDEDOR PRUEBA",
        precioVenta: 120,
        precioVendedor: 100,
      },
    ];

    await controller.notificarDiferenciasPrecioAuditoria(
      { usuarioId: 7, app: { get: jest.fn() } },
      filas,
    );
    await controller.notificarDiferenciasPrecioAuditoria(
      { usuarioId: 7, app: { get: jest.fn() } },
      filas,
    );

    expect(findOne).toHaveBeenCalledTimes(2);
    expect(create).not.toHaveBeenCalled();
  });
});

describe("comentario de auditoria de ventas", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("incluye el comentario persistido al formatear el reporte", () => {
    const venta = crearVentaTv({ ventaId: 3802, detalleId: 3678 });
    venta.comentarioAuditoria = "Validado contra el contrato";

    const [fila] = controller.formatearReporte([venta]);

    expect(fila.comentarioAuditoria).toBe("Validado contra el contrato");
  });

  test("guarda un comentario normalizado para la venta", async () => {
    const update = jest.fn().mockResolvedValue(undefined);
    jest.spyOn(Venta, "findByPk").mockResolvedValue({ id: 3802, update });
    const req = {
      params: { ventaId: "3802" },
      body: { comentarioAuditoria: "  Revisado por auditoria  " },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await controller.actualizarComentarioAuditoriaVenta(req, res);

    expect(Venta.findByPk).toHaveBeenCalledWith(3802);
    expect(update).toHaveBeenCalledWith({
      comentarioAuditoria: "Revisado por auditoria",
    });
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: true,
        venta: {
          id: 3802,
          comentarioAuditoria: "Revisado por auditoria",
        },
      }),
    );
  });

  test("permite limpiar el comentario persistido", async () => {
    const update = jest.fn().mockResolvedValue(undefined);
    jest.spyOn(Venta, "findByPk").mockResolvedValue({ id: 3802, update });
    const req = {
      params: { ventaId: "3802" },
      body: { comentarioAuditoria: "   " },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await controller.actualizarComentarioAuditoriaVenta(req, res);

    expect(update).toHaveBeenCalledWith({ comentarioAuditoria: null });
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        venta: { id: 3802, comentarioAuditoria: "" },
      }),
    );
  });

  test("rechaza comentarios mayores a 2000 caracteres", async () => {
    const findByPk = jest.spyOn(Venta, "findByPk");
    const req = {
      params: { ventaId: "3802" },
      body: { comentarioAuditoria: "a".repeat(2001) },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await controller.actualizarComentarioAuditoriaVenta(req, res);

    expect(findByPk).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test("guarda el comentario de una fila con error sin venta vinculada", async () => {
    actualizarComentarioResultadoAuditoriaVentasPdf.mockResolvedValue({
      auditoriaId: 70,
      resultadoIndex: 3,
      comentarioAuditoria: "Revisar datos del PDF",
    });
    const req = {
      params: { auditoriaId: "70", resultadoIndex: "3" },
      body: { comentarioAuditoria: "  Revisar datos del PDF  " },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await controller.actualizarComentarioAuditoriaResultadoPdf(req, res);

    expect(actualizarComentarioResultadoAuditoriaVentasPdf).toHaveBeenCalledWith({
      auditoriaId: 70,
      resultadoIndex: 3,
      comentarioAuditoria: "Revisar datos del PDF",
    });
    expect(res.json).toHaveBeenCalledWith({
      ok: true,
      message: "Comentario de auditoria actualizado",
      resultado: {
        auditoriaId: 70,
        resultadoIndex: 3,
        comentarioAuditoria: "Revisar datos del PDF",
      },
    });
  });
});
