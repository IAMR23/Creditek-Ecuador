jest.mock("../../models/ConciliacionModeloTv", () => ({
  findOne: jest.fn(),
}));

jest.mock("../../models/DetalleVenta", () => ({
  update: jest.fn(),
}));

const ConciliacionModeloTv = require("../../models/ConciliacionModeloTv");
const DetalleVenta = require("../../models/DetalleVenta");
const controller = require("./auditoriaVentasController");

const crearVentaTv = ({ ventaId, detalleId }) => ({
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
      contrato: "CONTRATO",
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

describe("auditarRegistrosPdf", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    ConciliacionModeloTv.findOne.mockResolvedValue({
      modeloRveId: 71,
      modeloRveNombre: "TV 32 PULG",
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
      { referenciaPdf: "LA32ZEC" },
      { where: { id: 3675 } },
    );
    expect(DetalleVenta.update).toHaveBeenNthCalledWith(
      2,
      { referenciaPdf: "LA32ZEC" },
      { where: { id: 3676 } },
    );
  });
});
