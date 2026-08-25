const { EventEmitter } = require("events");

jest.mock("fs", () => ({
  existsSync: jest.fn(),
}));

jest.mock("fs/promises", () => ({
  readFile: jest.fn(),
  rm: jest.fn(),
}));

jest.mock("child_process", () => ({
  spawn: jest.fn(),
}));

jest.mock("../../services/controlFinancieroService", () => ({
  guardarCargaControlFinanciero: jest.fn(),
  obtenerFechaReporte: jest.fn(),
}));

jest.mock("../../services/conciliacionEntradasService", () => ({
  conciliarCarga: jest.fn(),
}));

jest.mock("../../services/conciliacionCuotasCajaService", () => ({
  conciliarCargaCaja: jest.fn(),
}));

jest.mock("../../services/auditoriaVentasPdfService", () => ({
  auditarVentasDesdeDirectorios: jest.fn(),
}));

jest.mock("../../services/auditoriaVentasPersistenciaService", () => ({
  guardarAuditoriaVentasPdf: jest.fn(),
}));

jest.mock("../Auditoria/auditoriaVentasController", () => ({
  obtenerReporteAuditoria: jest.fn(),
  auditarRegistrosPdf: jest.fn(),
  contarDispositivosCreditoRve: jest.fn(),
  esFilaConIncidenciaAuditoriaPdf: jest.fn(),
  notificarDiferenciasPrecioAuditoria: jest.fn(),
}));

const fs = require("fs");
const fsp = require("fs/promises");
const { spawn } = require("child_process");
const {
  guardarCargaControlFinanciero,
  obtenerFechaReporte,
} = require("../../services/controlFinancieroService");
const {
  conciliarCarga,
} = require("../../services/conciliacionEntradasService");
const {
  conciliarCargaCaja,
} = require("../../services/conciliacionCuotasCajaService");
const {
  auditarVentasDesdeDirectorios,
} = require("../../services/auditoriaVentasPdfService");
const controller = require("./reportesCajaVentasController");

const resumenAuditoriaCompleta = {
  estado: "COMPLETADA",
  inconsistencias: 0,
  tv: { aplica: true, registros: 1, inconsistencias: 0 },
  celular: { aplica: false, registros: 0, inconsistencias: 0 },
  errores: [],
};

const crearRes = () => {
  const res = {
    headersSent: false,
    download: jest.fn(),
    json: jest.fn(),
    setHeader: jest.fn(),
    status: jest.fn(),
  };
  res.status.mockReturnValue(res);
  res.download.mockImplementation((_archivo, _nombre, callback) => callback());
  return res;
};

const crearProcesoPython = (resumen) => {
  const child = new EventEmitter();
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.kill = jest.fn();

  process.nextTick(() => {
    child.stdout.emit("data", Buffer.from(JSON.stringify(resumen)));
    child.emit("close", 0);
  });

  return child;
};

describe("reportesCajaVentasController", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fsp.rm.mockResolvedValue(undefined);
    auditarVentasDesdeDirectorios.mockResolvedValue(resumenAuditoriaCompleta);
    conciliarCargaCaja.mockResolvedValue(null);
  });

  test("procesa una solicitud que contiene solamente ventas TV", async () => {
    const datos = {
      registrosCaja: [],
      ventasTv: [{ FECHA: "7/25/26 10:00 AM", CONTRATO: "TV-1" }],
      ventasCelular: [],
    };
    fs.existsSync.mockReturnValue(true);
    fsp.readFile.mockResolvedValue(JSON.stringify(datos));
    spawn.mockReturnValue(
      crearProcesoPython({ registrosCaja: 0, ventasTv: 1, ventasCelular: 0 }),
    );
    obtenerFechaReporte.mockReturnValue("2026-07-25");
    guardarCargaControlFinanciero.mockResolvedValue({
      carga: { id: 25 },
      esCargaNueva: true,
      archivosAgregados: 1,
      archivosOmitidos: 0,
    });
    conciliarCarga.mockResolvedValue({ id: "31" });
    const res = crearRes();

    await controller.extraerCierreCajaConVentas(
      {
        files: { ventasTv: [{ originalname: "tv.pdf" }] },
        body: { asignacionesAgencias: "[]" },
        user: { id: 7 },
        reportesCajaVentasTempRoot: "C:/temp/reporte",
        reportesCajaDir: "C:/temp/reporte/caja",
        ventasTvDir: "C:/temp/reporte/tv",
        ventasCelularDir: "C:/temp/reporte/celular",
      },
      res,
    );

    expect(spawn).toHaveBeenCalledTimes(1);
    expect(obtenerFechaReporte).toHaveBeenCalledWith(datos.ventasTv);
    expect(guardarCargaControlFinanciero).toHaveBeenCalledWith(
      expect.objectContaining({ datos, usuarioId: 7 }),
    );
    expect(conciliarCarga).toHaveBeenCalledWith({
      cargaId: 25,
      origen: "CARGA",
      usuarioId: 7,
    });
    expect(auditarVentasDesdeDirectorios).toHaveBeenCalledWith(
      expect.objectContaining({
        directorioTv: "C:/temp/reporte/tv",
        directorioCelular: "C:/temp/reporte/celular",
        fechaInicio: "2026-07-25",
        fechaFin: "2026-07-25",
        usuarioId: 7,
        origenAuditoria: "CAJA",
        controlFinancieroCargaId: 25,
      }),
    );
    expect(res.setHeader).toHaveBeenCalledWith(
      "X-RVE-Conciliacion-Entradas",
      "31",
    );
    expect(res.setHeader).toHaveBeenCalledWith(
      "X-RVE-Auditoria-Estado",
      "COMPLETADA",
    );
    expect(res.setHeader).toHaveBeenCalledWith(
      "X-RVE-Auditoria-TV-Registros",
      "1",
    );
    expect(auditarVentasDesdeDirectorios.mock.invocationCallOrder[0]).toBeLessThan(
      res.download.mock.invocationCallOrder[0],
    );
    expect(auditarVentasDesdeDirectorios.mock.invocationCallOrder[0]).toBeLessThan(
      fsp.rm.mock.invocationCallOrder[0],
    );
    expect(res.status).not.toHaveBeenCalledWith(400);
    expect(res.download).toHaveBeenCalledWith(
      expect.any(String),
      "CIERRE_CAJA_20260725.xlsx",
      expect.any(Function),
    );
  });

  test("concilia caja automaticamente sin impedir la descarga", async () => {
    const datos = {
      registrosCaja: [
        { FECHA: "8/25/26 10:00 AM", CLIENTE: "JUAN PEREZ" },
      ],
      ventasTv: [],
      ventasCelular: [],
    };
    fs.existsSync.mockReturnValue(true);
    fsp.readFile.mockResolvedValue(JSON.stringify(datos));
    spawn.mockReturnValue(
      crearProcesoPython({ registrosCaja: 1, ventasTv: 0, ventasCelular: 0 }),
    );
    obtenerFechaReporte.mockReturnValue("2026-08-25");
    guardarCargaControlFinanciero.mockResolvedValue({
      carga: { id: 26 },
      esCargaNueva: true,
      archivosAgregados: 1,
      archivosOmitidos: 0,
    });
    conciliarCarga.mockResolvedValue(null);
    conciliarCargaCaja.mockResolvedValue({ id: "92" });
    const res = crearRes();

    await controller.extraerCierreCajaConVentas(
      {
        files: { reportesCaja: [{ originalname: "caja.pdf" }] },
        body: { asignacionesAgencias: "[]" },
        user: { id: 7 },
        reportesCajaVentasTempRoot: "C:/temp/reporte",
        reportesCajaDir: "C:/temp/reporte/caja",
        ventasTvDir: "C:/temp/reporte/tv",
        ventasCelularDir: "C:/temp/reporte/celular",
      },
      res,
    );

    expect(conciliarCargaCaja).toHaveBeenCalledWith({
      cargaId: 26,
      origen: "CARGA",
      usuarioId: 7,
    });
    expect(res.setHeader).toHaveBeenCalledWith(
      "X-RVE-Conciliacion-Caja",
      "92",
    );
    expect(res.download).toHaveBeenCalledTimes(1);
  });

  test("rechaza una solicitud sin archivos de ningun tipo", async () => {
    const res = crearRes();

    await controller.extraerCierreCajaConVentas(
      {
        files: {},
        reportesCajaVentasTempRoot: "C:/temp/reporte-vacio",
      },
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: false,
        message: expect.stringContaining("ventas TV o ventas celular"),
      }),
    );
    expect(spawn).not.toHaveBeenCalled();
  });

  test("descarga el Excel y reporta ERROR si falla la auditoria secundaria", async () => {
    const errorLog = jest.spyOn(console, "error").mockImplementation(() => {});
    const datos = {
      registrosCaja: [],
      ventasTv: [{ FECHA: "7/25/26 10:00 AM", CONTRATO: "TV-1" }],
      ventasCelular: [],
    };
    fs.existsSync.mockReturnValue(true);
    fsp.readFile.mockResolvedValue(JSON.stringify(datos));
    spawn.mockReturnValue(
      crearProcesoPython({ registrosCaja: 0, ventasTv: 1, ventasCelular: 0 }),
    );
    obtenerFechaReporte.mockReturnValue("2026-07-25");
    guardarCargaControlFinanciero.mockResolvedValue({
      carga: { id: 25 },
      esCargaNueva: true,
      archivosAgregados: 1,
      archivosOmitidos: 0,
    });
    conciliarCarga.mockResolvedValue(null);
    auditarVentasDesdeDirectorios.mockRejectedValue(
      new Error("Fallo del procesador TV"),
    );
    const res = crearRes();

    await controller.extraerCierreCajaConVentas(
      {
        files: { ventasTv: [{ originalname: "tv.pdf" }] },
        body: { asignacionesAgencias: "[]" },
        user: { id: 7 },
        reportesCajaVentasTempRoot: "C:/temp/reporte",
        reportesCajaDir: "C:/temp/reporte/caja",
        ventasTvDir: "C:/temp/reporte/tv",
        ventasCelularDir: "C:/temp/reporte/celular",
      },
      res,
    );

    expect(res.download).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalledWith(500);
    expect(res.setHeader).toHaveBeenCalledWith(
      "X-RVE-Auditoria-Estado",
      "ERROR",
    );
    expect(errorLog).toHaveBeenCalledWith(
      "Error inesperado ejecutando la auditoria automatica de ventas:",
      expect.any(Error),
    );
    errorLog.mockRestore();
  });
});
