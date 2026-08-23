jest.mock("../config/db", () => ({
  sequelize: {
    transaction: jest.fn(async (callback) => callback({ LOCK: { UPDATE: "UPDATE" } })),
  },
}));
jest.mock("../models/FacturaIaResultado", () => ({
  create: jest.fn(),
  findAll: jest.fn(),
  findAndCountAll: jest.fn(),
  findByPk: jest.fn(),
  count: jest.fn(),
  sum: jest.fn(),
  update: jest.fn(),
}));
jest.mock("../models/Usuario", () => ({}));

const FacturaIaResultado = require("../models/FacturaIaResultado");
const {
  cargarArchivoJson,
  extraerFacturasPayload,
  normalizarFacturaPayload,
  normalizarNumero,
  seleccionarResultado,
} = require("./facturasIaService");

describe("facturasIaService", () => {
  beforeEach(() => jest.clearAllMocks());

  test("normaliza la estructura recomendada y calcula la sumatoria", () => {
    const result = normalizarFacturaPayload({
      proveedor: { nombre: "AGRICOLA AGROTATI CIA. LTDA.", ruc: "1792291593001" },
      factura: {
        numero: "002-011-001277805",
        fechaEmision: "2026-08-19",
        subtotal: 10.09,
        iva: 1.51,
        total: 11.6,
      },
      productos: [
        {
          cantidad: 3.578,
          descripcion: "EXTRA",
          precioUnitario: 2.8191,
          descuento: 0,
          total: 10.09,
        },
      ],
    });

    expect(result.totalProductosCalculado).toBe(10.09);
    expect(result.diferenciaProductosSubtotal).toBe(0);
    expect(result.diferenciaSubtotalImpuestosTotal).toBe(0);
    expect(result.normalized.productos[0]).toEqual(
      expect.objectContaining({ descripcion: "EXTRA", totalUsado: 10.09 }),
    );
    expect(result.puntaje).toBeGreaterThanOrEqual(90);
  });

  test("calcula total de linea faltante sin modificar el payload original", () => {
    const payload = {
      factura: { subtotal: "20,00", impuestos: 3, total: 23 },
      productos: [{ descripcion: "Producto", cantidad: 2, precioUnitario: 10 }],
    };
    const result = normalizarFacturaPayload(payload);

    expect(result.totalProductosCalculado).toBe(20);
    expect(result.normalized.productos[0].totalFuente).toBeNull();
    expect(result.normalized.productos[0].totalCalculado).toBe(20);
    expect(payload.productos[0]).not.toHaveProperty("totalCalculado");
    expect(result.warnings).toEqual(
      expect.arrayContaining([expect.stringContaining("fue calculado")]),
    );
  });

  test("acepta una factura, un arreglo o el contenedor facturas", () => {
    expect(extraerFacturasPayload({ factura: { total: 1 } })).toHaveLength(1);
    expect(extraerFacturasPayload([{ total: 1 }, { total: 2 }])).toHaveLength(2);
    expect(extraerFacturasPayload({ facturas: [{ total: 1 }, { total: 2 }] })).toHaveLength(2);
  });

  test("normaliza numeros frecuentes sin redondear a dos decimales", () => {
    expect(normalizarNumero("$ 1.234,5678")).toBe(1234.5678);
    expect(normalizarNumero("2.8191")).toBe(2.8191);
  });

  test("carga JSON UTF-8, conserva el original y usa el grupo indicado", async () => {
    const payload = {
      proveedor: { nombre: "Compañía Ñ", ruc: "1792291593001" },
      factura: { numero: "001", subtotal: 10, impuestos: 1.5, total: 11.5 },
      productos: [{ descripcion: "Descripción", cantidad: 1, precioUnitario: 10, total: 10 }],
    };
    FacturaIaResultado.create.mockImplementation(async (values) => ({
      toJSON: () => ({ id: 1, ...values }),
    }));

    const results = await cargarArchivoJson({
      file: {
        originalname: "respuesta.json",
        size: Buffer.byteLength(JSON.stringify(payload)),
        buffer: Buffer.from(JSON.stringify(payload), "utf8"),
      },
      grupoComparacion: "Factura combustible agosto",
      usuarioId: 7,
    });

    expect(results).toHaveLength(1);
    expect(FacturaIaResultado.create).toHaveBeenCalledWith(
      expect.objectContaining({
        grupoComparacion: "Factura combustible agosto",
        payloadOriginal: payload,
        proveedor: "Compañía Ñ",
        creadoPorId: 7,
      }),
      expect.objectContaining({ transaction: expect.any(Object) }),
    );
  });

  test("seleccionar una opcion desmarca solo el mismo grupo y conserva resultados", async () => {
    const target = {
      grupoComparacion: "GRUPO-1",
      update: jest.fn().mockResolvedValue(undefined),
    };
    FacturaIaResultado.findByPk
      .mockResolvedValueOnce(target)
      .mockResolvedValueOnce({
        toJSON: () => ({ id: 9, grupoComparacion: "GRUPO-1", esSeleccionada: true }),
      });

    const result = await seleccionarResultado({ id: 9, usuarioId: 7 });

    expect(FacturaIaResultado.update).toHaveBeenCalledWith(
      expect.objectContaining({ esSeleccionada: false }),
      expect.objectContaining({
        where: { grupoComparacion: "GRUPO-1", esSeleccionada: true },
      }),
    );
    expect(target.update).toHaveBeenCalledWith(
      expect.objectContaining({ esSeleccionada: true, seleccionadoPorId: 7 }),
      expect.any(Object),
    );
    expect(result.esSeleccionada).toBe(true);
  });
});
