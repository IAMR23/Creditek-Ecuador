const { EventEmitter } = require("events");

jest.mock("child_process", () => ({
  spawn: jest.fn(),
}));
jest.mock("../models/FacturaFisica", () => ({}));
jest.mock("./facturasFisicasService", () => ({}));

const { spawn } = require("child_process");
const {
  OCR_TIMEOUT_MS,
  ejecutarProcesadorOcr,
} = require("./facturasFisicasOcrService");

describe("facturasFisicasOcr runner", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  test("el timeout termina el proceso OCR y responde con codigo trazable", async () => {
    const child = new EventEmitter();
    child.pid = 4321;
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.kill = jest.fn();
    spawn.mockReturnValue(child);
    const processKill = jest.spyOn(process, "kill").mockImplementation(() => true);

    const promise = ejecutarProcesadorOcr({
      archivo: "C:\\storage\\factura.jpg",
      mimeType: "image/jpeg",
      extension: "jpg",
      facturaId: 7,
    });
    jest.advanceTimersByTime(OCR_TIMEOUT_MS);
    child.emit("close", null);

    await expect(promise).rejects.toMatchObject({
      statusCode: 504,
      codigo: "OCR_TIMEOUT",
    });
    if (process.platform === "win32") {
      expect(child.kill).toHaveBeenCalled();
    } else {
      expect(processKill).toHaveBeenCalledWith(-4321, "SIGKILL");
    }
  });
});
