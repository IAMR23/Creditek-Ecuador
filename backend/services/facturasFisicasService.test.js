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

const FacturaFisica = require("../models/FacturaFisica");
const {
  MAX_FILE_SIZE_BYTES,
  crearFactura,
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
});
