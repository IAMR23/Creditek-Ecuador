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

const fs = require("fs");
const fsp = require("fs/promises");
const { spawn } = require("child_process");
const {
  guardarCargaControlFinanciero,
  obtenerFechaReporte,
} = require("../../services/controlFinancieroService");
const controller = require("./reportesCajaVentasController");

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
    expect(res.status).not.toHaveBeenCalledWith(400);
    expect(res.download).toHaveBeenCalledWith(
      expect.any(String),
      "CIERRE_CAJA_20260725.xlsx",
      expect.any(Function),
    );
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
});
