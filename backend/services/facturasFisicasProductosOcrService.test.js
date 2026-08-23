jest.mock("../models/FacturaFisica", () => ({
  findByPk: jest.fn(),
}));

jest.mock("../models/FacturaFisicaProductoOcr", () => ({
  bulkCreate: jest.fn(),
  count: jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
  max: jest.fn(),
  update: jest.fn(),
}));

jest.mock("../models/Usuario", () => ({}));

const FacturaFisica = require("../models/FacturaFisica");
const FacturaFisicaProductoOcr = require(
  "../models/FacturaFisicaProductoOcr",
);
const {
  cambiarEstadoProducto,
  editarProducto,
  listarProductos,
  persistirProductosDetectados,
  validarProductosProcesador,
} = require("./facturasFisicasProductosOcrService");

const crearProducto = (overrides = {}) => {
  const product = {
    id: 11,
    facturaFisicaId: 7,
    descripcion: "Monitor 24 pulgadas",
    cantidad: "2.000",
    precioUnitario: "100.00",
    descuento: "0.00",
    totalLinea: "200.00",
    codigo: "MON-24",
    advertencias: [],
    orden: 1,
    estado: "DETECTADO",
    esResultadoActual: true,
    editadoManualmente: false,
    update: jest.fn(async (values) => Object.assign(product, values)),
    ...overrides,
  };
  return product;
};

describe("facturasFisicasProductosOcrService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    FacturaFisica.findByPk.mockResolvedValue({
      id: 7,
      estado: "CARGADA",
      subtotal: "200.00",
      total: "230.00",
    });
  });

  test("acepta filas parciales sin inventar valores y advierte inconsistencias", () => {
    const products = validarProductosProcesador([
      { descripcion: "Servicio especial" },
      {
        descripcion: "Monitor",
        cantidad: 2,
        precioUnitario: 100,
        descuento: 10,
        totalLinea: 200,
      },
    ]);

    expect(products[0]).toEqual(
      expect.objectContaining({
        cantidad: null,
        precioUnitario: null,
        descuento: null,
        totalLinea: null,
        codigo: null,
      }),
    );
    expect(products[1].advertencias).toContain(
      "La cantidad por precio unitario no coincide con el total de linea.",
    );
  });

  test("rechaza una linea OCR sin descripcion", () => {
    expect(() => validarProductosProcesador([{ cantidad: 1 }])).toThrow(
      "La descripcion del producto es obligatoria",
    );
    expect(() => validarProductosProcesador([null])).toThrow(
      "El OCR devolvio una linea de producto invalida",
    );
  });

  test("conserva precio unitario exacto y datos variables del producto", () => {
    const [product] = validarProductosProcesador([
      {
        descripcion: "EXTRA",
        cantidad: 3.578,
        precioUnitario: 2.8191,
        totalLinea: 10.09,
        datosAdicionales: { unidadMedida: "GAL", subsidioUnitario: 0.7 },
      },
    ]);

    expect(product.precioUnitario).toBe(2.82);
    expect(product.precioUnitarioExacto).toBe(2.8191);
    expect(product.datosAdicionales).toEqual({
      unidadMedida: "GAL",
      subsidioUnitario: 0.7,
    });
    expect(product.advertencias).toEqual([]);
  });

  test("reprocesa creando una version nueva y solo inactiva resultados automaticos", async () => {
    FacturaFisicaProductoOcr.count.mockResolvedValue(2);
    FacturaFisicaProductoOcr.update.mockResolvedValue([3]);
    FacturaFisicaProductoOcr.max.mockResolvedValue(4);
    FacturaFisicaProductoOcr.bulkCreate.mockResolvedValue([]);
    const transaction = { id: "tx" };

    const result = await persistirProductosDetectados({
      facturaId: 7,
      productos: [{ descripcion: "Producto nuevo", totalLinea: 20 }],
      loteOcr: "lote-5",
      usuarioId: 9,
      transaction,
    });

    expect(result).toEqual({ creados: 1, preservados: 2, versionOcr: 5 });
    expect(FacturaFisicaProductoOcr.update).toHaveBeenCalledWith(
      { esResultadoActual: false },
      expect.objectContaining({ transaction }),
    );
    const where = FacturaFisicaProductoOcr.update.mock.calls[0][1].where;
    expect(where).toEqual(
      expect.objectContaining({ facturaFisicaId: 7, esResultadoActual: true }),
    );
    expect(FacturaFisicaProductoOcr.bulkCreate).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          descripcion: "Producto nuevo",
          loteOcr: "lote-5",
          versionOcr: 5,
          estado: "DETECTADO",
          detectadoPorId: 9,
        }),
      ],
      { transaction },
    );
    expect(FacturaFisicaProductoOcr.destroy).toBeUndefined();
  });

  test("edita solo un detectado, conserva nulos y registra correccion humana", async () => {
    const product = crearProducto({ cantidad: null, precioUnitario: null });
    FacturaFisicaProductoOcr.findOne.mockResolvedValue(product);

    const result = await editarProducto({
      facturaId: 7,
      productoId: 11,
      usuarioId: 9,
      payload: { descripcion: "Servicio corregido", totalLinea: "50,25" },
    });

    expect(product.update).toHaveBeenCalledWith(
      expect.objectContaining({
        descripcion: "Servicio corregido",
        totalLinea: 50.25,
        editadoManualmente: true,
        actualizadoPorId: 9,
      }),
    );
    expect(result.cantidad).toBeNull();
    expect(result.precioUnitario).toBeNull();
  });

  test("una correccion humana de precio conserva hasta seis decimales", async () => {
    const product = crearProducto();
    FacturaFisicaProductoOcr.findOne.mockResolvedValue(product);

    const result = await editarProducto({
      facturaId: 7,
      productoId: 11,
      usuarioId: 9,
      payload: { precioUnitario: "2.8191" },
    });

    expect(product.update).toHaveBeenCalledWith(
      expect.objectContaining({
        precioUnitario: 2.82,
        precioUnitarioExacto: 2.8191,
        editadoManualmente: true,
      }),
    );
    expect(result.precioUnitarioExacto).toBe(2.8191);
  });

  test("confirma y descarta mediante cambios de estado, nunca eliminando", async () => {
    const detected = crearProducto();
    FacturaFisicaProductoOcr.findOne.mockResolvedValueOnce(detected);
    await cambiarEstadoProducto({
      facturaId: 7,
      productoId: 11,
      usuarioId: 9,
      estado: "CONFIRMADO",
    });
    expect(detected.update).toHaveBeenCalledWith(
      expect.objectContaining({ estado: "CONFIRMADO", confirmadoPorId: 9 }),
    );

    const confirmed = crearProducto({ estado: "CONFIRMADO" });
    FacturaFisicaProductoOcr.findOne.mockResolvedValueOnce(confirmed);
    await cambiarEstadoProducto({
      facturaId: 7,
      productoId: 11,
      usuarioId: 9,
      estado: "DESCARTADO",
    });
    expect(confirmed.update).toHaveBeenCalledWith(
      expect.objectContaining({ estado: "DESCARTADO", descartadoPorId: 9 }),
    );
    expect(FacturaFisicaProductoOcr.destroy).toBeUndefined();
  });

  test("resume lineas actuales y compara su suma con el subtotal", async () => {
    FacturaFisicaProductoOcr.findAll.mockResolvedValue([
      crearProducto({ totalLinea: "120.00" }),
      crearProducto({ id: 12, orden: 2, totalLinea: "70.00" }),
    ]);

    const result = await listarProductos(7);

    expect(result.resumen).toEqual(
      expect.objectContaining({
        cantidad: 2,
        sumaTotalesLinea: 190,
        sumaCompleta: true,
        comparadoCon: "subtotal",
        diferencia: 10,
      }),
    );
    expect(result.resumen.advertencias).toContain(
      "La suma de productos no coincide con el subtotal de la factura.",
    );
  });

  test("bloquea cambios sobre facturas anuladas", async () => {
    FacturaFisica.findByPk.mockResolvedValue({ id: 7, estado: "ANULADA" });

    await expect(
      editarProducto({
        facturaId: 7,
        productoId: 11,
        usuarioId: 9,
        payload: { descripcion: "No permitido" },
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(FacturaFisicaProductoOcr.findOne).not.toHaveBeenCalled();
  });
});
