jest.mock("../config/db", () => ({
  sequelize: {
    define: jest.fn(() => ({})),
    transaction: jest.fn((callback) => callback({ id: "test-transaction" })),
  },
}));
jest.mock("../models/FacturaRegistro", () => ({}));
jest.mock("../models/Usuario", () => ({}));
jest.mock("fs/promises", () => ({
  mkdir: jest.fn(),
  writeFile: jest.fn(),
  unlink: jest.fn(),
}));

const {
  actualizarFactura,
  cargarJsonTexto,
  eliminarFactura,
  extraerFacturas,
  guardarFotoFactura,
  listar,
  marcarRevisada,
  normalizarFactura,
  normalizarDepartamento,
  normalizarFiltros,
  normalizarMonto,
  normalizarTipoDocumentoFoto,
  parsearExcel,
  validarFotoFactura,
} = require("./facturasService");
const FacturaRegistro = require("../models/FacturaRegistro");
const fs = require("fs/promises");
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
      departamento: "LOGISTICA",
    });
  });

  test("acepta arreglo, objeto facturas y registro individual", () => {
    expect(extraerFacturas([{ a: 1 }])).toHaveLength(1);
    expect(extraerFacturas({ facturas: [{ a: 1 }, { a: 2 }] })).toHaveLength(2);
    expect(extraerFacturas({ a: 1 })).toEqual([{ a: 1 }]);
  });

  test("normaliza los departamentos permitidos y rechaza valores desconocidos", () => {
    expect(normalizarDepartamento("logística")).toBe("LOGISTICA");
    expect(normalizarDepartamento(" comercial ")).toBe("COMERCIAL");
    expect(normalizarDepartamento("Sistemas")).toBe("SISTEMAS");
    expect(() => normalizarDepartamento("Contabilidad")).toThrow(/Departamento no valido/);
  });

  test("asigna Logistica por defecto al importar una factura", () => {
    expect(normalizarFactura({ numeroFactura: "DEP-001" })).toMatchObject({
      departamento: "LOGISTICA",
    });
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

  test.each([
    ["Factura", "Factura"],
    ["nota de venta", "Nota de Venta"],
    ["OTROS", "Otros"],
  ])("normaliza el tipo de documento del repartidor: %s", (entrada, esperado) => {
    expect(normalizarTipoDocumentoFoto(entrada)).toBe(esperado);
  });

  test.each([undefined, "", "Recibo"])(
    "exige un tipo de documento permitido al repartidor",
    (tipo) => {
      expect(() => normalizarTipoDocumentoFoto(tipo)).toThrow(
        /Selecciona el tipo de documento/,
      );
    },
  );

  test("guarda el tipo seleccionado junto con la foto de Gerencia", async () => {
    const factura = {
      id: 7,
      enlaceFoto: null,
      update: jest.fn(async function update(datos) {
        Object.assign(this, datos);
      }),
      toJSON() {
        return { ...this, update: undefined, toJSON: undefined };
      },
    };
    FacturaRegistro.findByPk = jest.fn().mockResolvedValue(factura);
    fs.mkdir.mockResolvedValue();
    fs.writeFile.mockResolvedValue();

    const resultado = await guardarFotoFactura({
      id: 7,
      file: {
        buffer: Buffer.from("RIFF0000WEBPimagen"),
        size: 20,
        mimetype: "image/webp",
      },
      userId: 3,
      tipo: "Nota de Venta",
    });

    expect(factura.update).toHaveBeenCalledWith(expect.objectContaining({
      tipo: "Nota de Venta",
      cargadoPorId: 3,
      revisada: false,
    }));
    expect(resultado.tipo).toBe("Nota de Venta");
  });

  test("elimina definitivamente el registro y su foto local", async () => {
    const factura = {
      id: 7,
      enlaceFoto: "/uploads/facturas/factura.webp",
      destroy: jest.fn().mockResolvedValue(),
    };
    FacturaRegistro.findByPk = jest.fn().mockResolvedValue(factura);
    fs.unlink.mockResolvedValue();

    await expect(eliminarFactura({ id: 7 })).resolves.toEqual({ id: 7 });

    expect(factura.destroy).toHaveBeenCalledTimes(1);
    expect(fs.unlink).toHaveBeenCalledWith(expect.stringMatching(/factura\.webp$/));
  });

  test("no elimina una factura inexistente", async () => {
    FacturaRegistro.findByPk = jest.fn().mockResolvedValue(null);

    await expect(eliminarFactura({ id: 999 })).rejects.toMatchObject({ statusCode: 404 });
  });

  test("rechaza una imagen cuya firma no coincide con el formato", () => {
    const buffer = Buffer.from("contenido que no es una imagen");
    expect(() =>
      validarFotoFactura({
        buffer,
        size: buffer.length,
        mimetype: "image/webp",
      }),
    ).toThrow(/WEBP valido/);
  });

  test("filtra la fecha de carga usando el dia completo de Ecuador", () => {
    const where = normalizarFiltros({
      fechaCargaInicio: "2026-11-10",
      fechaCargaFin: "2026-11-11",
    });

    expect(where.createdAt[require("sequelize").Op.gte].toISOString())
      .toBe("2026-11-10T05:00:00.000Z");
    expect(where.createdAt[require("sequelize").Op.lte].toISOString())
      .toBe("2026-11-12T04:59:59.999Z");
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

  test("permite numeros repetidos dentro de la misma carga", async () => {
    FacturaRegistro.bulkCreate = jest.fn(async (registros) => registros);

    const resultado = await cargarJsonTexto({
      contenido: JSON.stringify([
        { numeroFactura: "001-001-0001" },
        { numeroFactura: "001-001-0001" },
      ]),
    });

    expect(resultado).toHaveLength(2);
    expect(FacturaRegistro.bulkCreate).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ numeroFactura: "001-001-0001" }),
        expect.objectContaining({ numeroFactura: "001-001-0001" }),
      ]),
      expect.objectContaining({ validate: true, returning: true }),
    );
  });

  test("actualiza los campos editables de una factura", async () => {
    const factura = {
      id: 7,
      numeroFactura: "001-001-0001",
      update: jest.fn(async function update(datos) {
        Object.assign(this, datos);
      }),
      toJSON() {
        return { ...this, update: undefined, toJSON: undefined };
      },
    };
    FacturaRegistro.findByPk = jest.fn().mockResolvedValue(factura);
    FacturaRegistro.findOne = jest.fn().mockResolvedValue(null);

    await expect(
      actualizarFactura({
        id: 7,
        payload: {
          proveedor: " Proveedor actualizado ",
          numeroFactura: "001-001-0002",
          subtotal: "100,50",
          iva: "15,08",
          total: "115,58",
          departamento: "comercial",
        },
      }),
    ).resolves.toMatchObject({
      id: 7,
      proveedor: "Proveedor actualizado",
      numeroFactura: "001-001-0002",
      subtotal: 100.5,
      iva: 15.08,
      total: 115.58,
      departamento: "COMERCIAL",
    });
    expect(factura.update).toHaveBeenCalled();
  });

  test("permite editar una factura con un numero ya registrado", async () => {
    const factura = {
      id: 7,
      numeroFactura: "001-001-0001",
      update: jest.fn(async function update(datos) {
        Object.assign(this, datos);
      }),
      toJSON() {
        return { ...this, update: undefined, toJSON: undefined };
      },
    };
    FacturaRegistro.findByPk = jest.fn().mockResolvedValue(factura);

    await expect(
      actualizarFactura({ id: 7, payload: { numeroFactura: "001-001-0002" } }),
    ).resolves.toMatchObject({ numeroFactura: "001-001-0002" });
  });

  test("marca una foto como revisada sin impedir volver a consultarla", async () => {
    const factura = {
      id: 7,
      enlaceFoto: "/uploads/facturas/factura.webp",
      update: jest.fn(async function update(datos) {
        Object.assign(this, datos);
      }),
      toJSON() {
        return { ...this, update: undefined, toJSON: undefined };
      },
    };
    FacturaRegistro.findByPk = jest.fn().mockResolvedValue(factura);

    const resultado = await marcarRevisada({ id: 7, userId: 3 });

    expect(resultado).toMatchObject({ revisada: true, revisadaPorId: 3 });
    expect(resultado.revisadaAt).toBeInstanceOf(Date);
    expect(factura.enlaceFoto).toBe("/uploads/facturas/factura.webp");
  });

  test("filtra facturas por departamento", () => {
    expect(normalizarFiltros({ departamento: "sistemas" }))
      .toMatchObject({ departamento: "SISTEMAS" });
  });

  test("ordena el historial por la fecha de carga mas reciente", async () => {
    FacturaRegistro.findAndCountAll = jest.fn().mockResolvedValue({
      rows: [],
      count: 0,
    });
    FacturaRegistro.sum = jest.fn().mockResolvedValue(0);
    FacturaRegistro.findAll = jest.fn().mockResolvedValue([]);

    await listar({ page: 1, limit: 25 });

    expect(FacturaRegistro.findAndCountAll).toHaveBeenCalledWith(
      expect.objectContaining({
        order: [["createdAt", "DESC"], ["id", "DESC"]],
      }),
    );
  });
});
