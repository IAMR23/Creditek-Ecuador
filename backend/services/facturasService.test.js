jest.mock("../config/db", () => ({
  sequelize: { define: jest.fn(() => ({})) },
}));
jest.mock("../models/FacturaRegistro", () => ({}));
jest.mock("../models/Usuario", () => ({}));

const {
  cargarJsonTexto,
  extraerFacturas,
  normalizarFactura,
  normalizarMonto,
  parsearExcel,
  validarFotoFactura,
  validarNumerosFacturaDisponibles,
} = require("./facturasService");
const FacturaRegistro = require("../models/FacturaRegistro");
const ExcelJS = require("exceljs");

describe("facturasService", () => {
  test("normaliza encabezados visibles y montos ecuatorianos", () => {
    expect(
      normalizarFactura({
        "Fecha de factura": "19/10/2026",
        Proveedor: "Proveedor Uno",
        "RUC / Cédula": "1790012345001",
        "N.º de factura": "001-001-000123456",
        Subtotal: "$ 1.250,50",
        IVA: "187,58",
        Total: "1.438,08",
        "Forma de pago": "Transferencia",
        Estado: "Pagada",
        "Enlace a la foto": "https://example.com/factura.jpg",
        Observaciones: "Carga inicial",
        TIPO: "Compra",
      }),
    ).toEqual({
      fechaFactura: "2026-10-19",
      proveedor: "Proveedor Uno",
      identificacionProveedor: "1790012345001",
      numeroFactura: "001-001-000123456",
      subtotal: 1250.5,
      iva: 187.58,
      total: 1438.08,
      formaPago: "Transferencia",
      estado: "Pagada",
      enlaceFoto: "https://example.com/factura.jpg",
      observaciones: "Carga inicial",
      tipo: "Compra",
    });
  });

  test("acepta arreglo, objeto facturas y registro individual", () => {
    expect(extraerFacturas([{ a: 1 }])).toHaveLength(1);
    expect(extraerFacturas({ facturas: [{ a: 1 }, { a: 2 }] })).toHaveLength(2);
    expect(extraerFacturas({ a: 1 })).toEqual([{ a: 1 }]);
  });

  test("acepta facturas sin RUC o cedula y deja la identificacion vacia", () => {
    expect(
      normalizarFactura({
        fechaFactura: "2026-10-19",
        proveedor: "Proveedor sin identificacion",
        numeroFactura: "SIN-RUC-001",
        subtotal: 100,
        iva: 15,
        total: 115,
        formaPago: "Efectivo",
        estado: "Pagada",
        tipo: "Compra",
      }),
    ).toMatchObject({
      identificacionProveedor: null,
      numeroFactura: "SIN-RUC-001",
    });
  });

  test("carga un total inconsistente y registra la advertencia en observaciones", () => {
    const base = {
      fechaFactura: "2026-10-19",
      proveedor: "Proveedor",
      ruc: "1790012345001",
      numeroFactura: "001",
      subtotal: 100,
      iva: 15,
      total: 115,
      formaPago: "Efectivo",
      estado: "Pagada",
      tipo: "Compra",
    };

    expect(
      normalizarFactura({
        ...base,
        total: 114,
        observaciones: "Dato recibido del proveedor",
      }),
    ).toMatchObject({
      total: 114,
      observaciones:
        "Advertencia: Subtotal mas IVA no coincide con el total | Dato recibido del proveedor",
    });
  });

  test("carga campos permitidos vacios sin generar advertencias", () => {
    expect(
      normalizarFactura({
        fechaFactura: "2026-10-19",
        total: 115,
        estado: "Pagada",
        tipo: "Compra",
      }),
    ).toMatchObject({
      proveedor: null,
      numeroFactura: null,
      subtotal: null,
      iva: null,
      formaPago: null,
      observaciones: null,
    });
  });

  test("carga enlaces no seguros como vacios y registra la advertencia", () => {
    const base = {
      fechaFactura: "2026-10-19",
      proveedor: "Proveedor",
      ruc: "1790012345001",
      numeroFactura: "001",
      subtotal: 100,
      iva: 15,
      total: 115,
      formaPago: "Efectivo",
      estado: "Pagada",
      tipo: "Compra",
    };
    expect(
      normalizarFactura({ ...base, enlaceFoto: "javascript:alert(1)" }),
    ).toMatchObject({
      enlaceFoto: null,
      observaciones:
        "Advertencia: Enlace a la foto no es una URL http o https valida",
    });
  });

  test("carga una factura sin ningun campo", () => {
    expect(normalizarFactura({})).toMatchObject({
      fechaFactura: null,
      proveedor: null,
      numeroFactura: null,
      subtotal: null,
      iva: null,
      total: null,
      formaPago: null,
      estado: null,
      tipo: null,
      observaciones: null,
    });
  });

  test("rechaza montos negativos", () => {
    expect(normalizarMonto("-1.00")).toBeNull();
  });

  test("acepta una foto WEBP ligera y valida su firma", () => {
    const buffer = Buffer.from("RIFF0000WEBPimagen");
    expect(
      validarFotoFactura({
        buffer,
        size: buffer.length,
        mimetype: "image/webp",
      }),
    ).toBe(".webp");
  });

  test("rechaza una imagen cuya firma no coincide con el formato", () => {
    const buffer = Buffer.from("contenido que no es una imagen");
    expect(() =>
      validarFotoFactura({
        buffer,
        size: buffer.length,
        mimetype: "image/webp",
      }),
    ).toThrow(/JPG, PNG o WEBP valida/);
  });

  test("rechaza contenido pegado que no sea JSON valido", async () => {
    await expect(
      cargarJsonTexto({ contenido: "{invalido", usuarioId: 9 }),
    ).rejects.toThrow(/no es un JSON valido/);
  });

  test("convierte la primera hoja de Excel en facturas", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Facturas");
    sheet.addRow([
      "Fecha de factura",
      "Proveedor",
      "RUC / Cedula",
      "N. de factura",
      "Subtotal",
      "IVA",
      "Total",
      "Forma de pago",
      "Estado",
      "Enlace a la foto",
      "Observaciones",
      "TIPO",
    ]);
    sheet.addRow([
      new Date("2026-10-19T00:00:00.000Z"),
      "Proveedor Excel",
      "1790012345001",
      "001-001-0003",
      100,
      15,
      115,
      "Transferencia",
      "Pagada",
      "https://example.com/factura.jpg",
      "Desde Excel",
      "Compra",
    ]);
    const rows = await parsearExcel(Buffer.from(await workbook.xlsx.writeBuffer()));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      Proveedor: "Proveedor Excel",
      "N. de factura": "001-001-0003",
      Total: 115,
    });
    expect(normalizarFactura(rows[0])).toMatchObject({
      fechaFactura: "2026-10-19",
      proveedor: "Proveedor Excel",
      identificacionProveedor: "1790012345001",
      numeroFactura: "001-001-0003",
      subtotal: 100,
      iva: 15,
      total: 115,
    });
  });

  test("rechaza numeros repetidos dentro del mismo JSON", async () => {
    await expect(
      validarNumerosFacturaDisponibles([
        { numeroFactura: "001-001-0001" },
        { numeroFactura: "001-001-0001" },
      ]),
    ).rejects.toMatchObject({ statusCode: 409, duplicados: ["001-001-0001"] });
  });

  test("permite varios registros sin numero de factura", async () => {
    FacturaRegistro.findAll = jest.fn();

    await expect(
      validarNumerosFacturaDisponibles([
        { numeroFactura: null },
        { numeroFactura: null },
      ]),
    ).resolves.toBeUndefined();
    expect(FacturaRegistro.findAll).not.toHaveBeenCalled();
  });

  test("rechaza numeros de factura que ya existen en la base", async () => {
    FacturaRegistro.findAll = jest.fn().mockResolvedValue([
      { numeroFactura: "001-001-0002" },
    ]);
    await expect(
      validarNumerosFacturaDisponibles([{ numeroFactura: "001-001-0002" }]),
    ).rejects.toMatchObject({ statusCode: 409, duplicados: ["001-001-0002"] });
  });
});
