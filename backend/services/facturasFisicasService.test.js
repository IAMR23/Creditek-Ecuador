jest.mock("../models/FacturaFisica", () => ({
  ESTADOS: [
    "CARGADA",
    "PENDIENTE_REVISION",
    "REVISADA",
    "CONFIRMADA",
    "ANULADA",
    "ERROR",
  ],
  count: jest.fn(),
  create: jest.fn(),
  findAll: jest.fn(),
  findAndCountAll: jest.fn(),
  findByPk: jest.fn(),
  findOne: jest.fn(),
}));

jest.mock("../models/Usuario", () => ({}));

jest.mock("fs/promises", () => ({
  access: jest.fn(),
  mkdir: jest.fn(),
  writeFile: jest.fn(),
}));

const FacturaFisica = require("../models/FacturaFisica");
const fs = require("fs/promises");
const {
  MAX_FILE_SIZE_BYTES,
  crearFactura,
  obtenerFactura,
  validarArchivo,
} = require("./facturasFisicasService");

const crearArchivo = (overrides = {}) => ({
  originalname: "factura.jpg",
  mimetype: "image/jpeg",
  size: 128,
  buffer: Buffer.from("archivo-de-prueba"),
  ...overrides,
});

describe("facturasFisicasService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("acepta formatos iniciales permitidos", () => {
    expect(validarArchivo(crearArchivo({ originalname: "a.jpg", mimetype: "image/jpeg" }))).toBe(".jpg");
    expect(validarArchivo(crearArchivo({ originalname: "a.jpeg", mimetype: "image/jpeg" }))).toBe(".jpeg");
    expect(validarArchivo(crearArchivo({ originalname: "a.png", mimetype: "image/png" }))).toBe(".png");
    expect(validarArchivo(crearArchivo({ originalname: "a.webp", mimetype: "image/webp" }))).toBe(".webp");
    expect(validarArchivo(crearArchivo({ originalname: "a.pdf", mimetype: "application/pdf" }))).toBe(".pdf");
  });

  test("rechaza formato invalido y archivo sobre el limite", () => {
    expect(() =>
      validarArchivo(
        crearArchivo({ originalname: "factura.txt", mimetype: "text/plain" }),
      ),
    ).toThrow("Solo se permiten");

    expect(() =>
      validarArchivo(
        crearArchivo({
          originalname: "factura.pdf",
          mimetype: "application/pdf",
          size: MAX_FILE_SIZE_BYTES + 1,
        }),
      ),
    ).toThrow("15 MB");
  });

  test("detecta duplicados por SHA-256 antes de crear registro", async () => {
    FacturaFisica.findOne.mockResolvedValue({
      toJSON: () => ({
        id: 77,
        nombreArchivoOriginal: "factura-original.pdf",
        estado: "CARGADA",
        createdAt: "2026-08-18T10:00:00.000Z",
      }),
    });

    await expect(
      crearFactura({
        file: crearArchivo({
          originalname: "copia.pdf",
          mimetype: "application/pdf",
        }),
        usuarioId: 10,
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
      duplicado: true,
      facturaExistente: expect.objectContaining({ id: 77 }),
    });

    expect(FacturaFisica.create).not.toHaveBeenCalled();
  });

  test("conserva el archivo original y registra CELULAR para una foto de camara", async () => {
    const file = crearArchivo({
      originalname: "foto-factura.jpg",
      buffer: Buffer.from("fotografia-original-sin-compresion"),
      size: 31,
    });
    FacturaFisica.findOne.mockResolvedValue(null);
    FacturaFisica.create.mockResolvedValue({ id: 91 });
    FacturaFisica.findByPk.mockResolvedValue({
      toJSON: () => ({
        id: 91,
        origenCarga: "CELULAR",
        sizeBytes: file.size,
        subtotal: null,
        impuestos: null,
        total: null,
      }),
    });

    const factura = await crearFactura({
      file,
      body: { origenCarga: "CELULAR" },
      usuarioId: 10,
    });

    expect(FacturaFisica.create).toHaveBeenCalledWith(
      expect.objectContaining({
        nombreArchivoOriginal: "foto-factura.jpg",
        origenCarga: "CELULAR",
        sizeBytes: 31,
      }),
    );
    expect(fs.writeFile).toHaveBeenCalledWith(
      expect.any(String),
      file.buffer,
      { flag: "wx" },
    );
    expect(factura.origenCarga).toBe("CELULAR");
  });

  test("mantiene WEB como origen predeterminado de la carga normal", async () => {
    FacturaFisica.findOne.mockResolvedValue(null);
    FacturaFisica.create.mockResolvedValue({ id: 92 });
    FacturaFisica.findByPk.mockResolvedValue({
      toJSON: () => ({
        id: 92,
        origenCarga: "WEB",
        sizeBytes: 128,
        subtotal: null,
        impuestos: null,
        total: null,
      }),
    });

    await crearFactura({ file: crearArchivo(), body: {}, usuarioId: 10 });

    expect(FacturaFisica.create).toHaveBeenCalledWith(
      expect.objectContaining({ origenCarga: "WEB" }),
    );
  });

  test("no expone la ruta interna del archivo al consultar la factura", async () => {
    FacturaFisica.findByPk.mockResolvedValue({
      toJSON: () => ({
        id: 7,
        rutaArchivo: "C:\\storage\\facturas_fisicas\\2026\\08\\secreto.pdf",
        sizeBytes: 100,
        subtotal: null,
        impuestos: null,
        total: 15,
      }),
    });

    const factura = await obtenerFactura(7);
    expect(factura).not.toHaveProperty("rutaArchivo");
    expect(factura.total).toBe(15);
  });
});
