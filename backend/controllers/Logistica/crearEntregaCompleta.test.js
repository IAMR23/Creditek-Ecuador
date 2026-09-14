jest.mock("../../config/db", () => ({
  sequelize: {
    transaction: jest.fn(),
  },
}));
jest.mock("../../models/DispositivoMarca", () => ({ findByPk: jest.fn() }));
jest.mock("../../models/Entrega", () => ({ create: jest.fn() }));
jest.mock("../../models/DetalleEntrega", () => ({ create: jest.fn() }));
jest.mock("../../models/EntregaObsequio", () => ({ create: jest.fn() }));
jest.mock("../../services/personasService", () => ({
  registrarPersona: jest.fn(),
}));
jest.mock("../../services/ventaEntregaRelacionService", () => ({
  resolverVentaParaEntrega: jest.fn(),
}));
jest.mock("../../utils/validarUbicacionCliente", () => ({
  esUbicacionClienteValida: jest.fn(() => true),
  MENSAJE_UBICACION_CLIENTE_INVALIDA: "Ubicacion invalida",
}));
jest.mock("../../utils/procesoLlamadaEntrega", () => ({
  resolverProcesoLlamada: jest.fn(() => ({
    requisitosCompletos: true,
    fechaHoraLlamada: null,
    fotoFechaLlamada: null,
  })),
}));

const { sequelize } = require("../../config/db");
const DispositivoMarca = require("../../models/DispositivoMarca");
const Entrega = require("../../models/Entrega");
const DetalleEntrega = require("../../models/DetalleEntrega");
const { registrarPersona } = require("../../services/personasService");
const {
  resolverVentaParaEntrega,
} = require("../../services/ventaEntregaRelacionService");
const { crearEntregaCompleta } = require("./crearEntregaCompleta");

describe("crearEntregaCompleta", () => {
  test("guarda el ventaId resuelto dentro de la misma transaccion", async () => {
    const transaction = {
      commit: jest.fn(),
      rollback: jest.fn(),
    };
    sequelize.transaction.mockResolvedValue(transaction);
    registrarPersona.mockResolvedValue({
      id: 20,
      cedula: "0912345678",
    });
    resolverVentaParaEntrega.mockResolvedValue({
      ventaId: 77,
      tipoCoincidencia: "CLIENTE_ID",
      criterioDesambiguacion: null,
      ambigua: false,
      cantidadCandidatas: 1,
      advertencia: null,
    });
    Entrega.create.mockResolvedValue({ id: 88 });
    DispositivoMarca.findByPk.mockResolvedValue({ dispositivoId: 1 });
    DetalleEntrega.create.mockResolvedValue({ id: 99 });

    const payload = {
      cliente: { cedula: "0912345678" },
      entrega: {
        usuarioAgenciaId: 5,
        origenId: 2,
        fecha: "2026-09-14",
        estado: "Pendiente",
      },
      detalle: {
        cantidad: 1,
        precioUnitario: 100,
        precioVendedor: 120,
        dispositivoMarcaId: 3,
        modeloId: 4,
        formaPagoId: 2,
        entrada: 20,
        alcance: 0,
        contrato: "CTR-77",
        ubicacion: "Quito",
      },
      obsequios: [],
    };
    const req = { body: { data: JSON.stringify(payload) }, file: null };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await crearEntregaCompleta(req, res);

    expect(Entrega.create).toHaveBeenCalledWith(
      expect.objectContaining({
        clienteId: 20,
        ventaId: 77,
      }),
      { transaction },
    );
    expect(transaction.commit).toHaveBeenCalled();
    expect(transaction.rollback).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
  });
});
