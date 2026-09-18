jest.mock("../config/db", () => ({
  sequelize: {
    col: jest.fn((value) => value),
    fn: jest.fn((name, value) => ({ name, value })),
    query: jest.fn(),
    transaction: jest.fn(async (callback) => callback({ LOCK: { UPDATE: "UPDATE" } })),
  },
}));

jest.mock("../models/SistemaTicket", () => ({
  count: jest.fn(),
  create: jest.fn(),
  findAll: jest.fn(),
  findAndCountAll: jest.fn(),
  findByPk: jest.fn(),
}));
jest.mock("../models/SistemaTicketComentario", () => ({ count: jest.fn(), create: jest.fn() }));
jest.mock("../models/SistemaTicketArchivo", () => ({
  bulkCreate: jest.fn(),
  count: jest.fn(),
  findOne: jest.fn(),
}));
jest.mock("../models/SistemaTicketHistorial", () => ({ create: jest.fn() }));
jest.mock("../models/Usuario", () => ({ findAll: jest.fn() }));
jest.mock("../middleware/uploadTicketsTi", () => ({ uploadsTicketsDir: __dirname }));

const { sequelize } = require("../config/db");
const SistemaTicket = require("../models/SistemaTicket");
const SistemaTicketComentario = require("../models/SistemaTicketComentario");
const SistemaTicketArchivo = require("../models/SistemaTicketArchivo");
const SistemaTicketHistorial = require("../models/SistemaTicketHistorial");
const service = require("./ticketsTiService");

describe("ticketsTiService", () => {
  beforeEach(() => jest.clearAllMocks());

  test("pagina y filtra siempre por solicitante para un usuario normal", async () => {
    SistemaTicket.findAndCountAll.mockResolvedValue({ rows: [], count: 0 });

    const resultado = await service.listar({
      query: { pagina: "2", limite: "15", estado: "Pruebas", proyecto: "RVE" },
      user: { id: 77, permisos: ["Ventas"] },
    });

    expect(SistemaTicket.findAndCountAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          solicitanteId: 77,
          estado: "Pruebas",
          proyecto: "RVE",
        }),
        limit: 15,
        offset: 15,
      }),
    );
    expect(resultado.paginacion).toEqual(
      expect.objectContaining({ pagina: 2, limite: 15, total: 0 }),
    );
  });

  test("crea código desde secuencia e historial dentro de una transacción", async () => {
    sequelize.query.mockResolvedValue([{ numero: "12" }]);
    SistemaTicket.create.mockResolvedValue({ id: 9 });
    SistemaTicketArchivo.bulkCreate.mockResolvedValue([]);
    SistemaTicketHistorial.create.mockResolvedValue({ id: 1 });
    SistemaTicket.findByPk.mockResolvedValue({
      get: () => ({
        id: 9,
        codigo: "TI-0012",
        estado: "Solicitado",
        solicitanteId: 4,
      }),
    });

    const resultado = await service.crear({
      data: {
        titulo: "Configurar acceso",
        descripcion: "Se requiere acceso al sistema para el equipo.",
        tipo: "Soporte",
        proyecto: "RVE",
        areaSolicitante: "Ventas",
        prioridad: "Media",
        fechaInicio: "2026-09-18",
        fechaEstimada: "2026-09-25",
      },
      files: [],
      user: { id: 4, permisos: ["Ventas"] },
    });

    expect(sequelize.transaction).toHaveBeenCalledTimes(1);
    expect(sequelize.query).toHaveBeenCalledWith(
      expect.stringContaining("nextval('sistemas_tickets_codigo_seq')"),
      expect.objectContaining({ transaction: expect.any(Object) }),
    );
    expect(SistemaTicket.create).toHaveBeenCalledWith(
      expect.objectContaining({
        codigo: "TI-0012",
        estado: "Solicitado",
        solicitanteId: 4,
        fechaInicio: "2026-09-18",
        fechaEstimada: "2026-09-25",
      }),
      expect.objectContaining({ transaction: expect.any(Object) }),
    );
    expect(SistemaTicketHistorial.create).toHaveBeenCalledWith(
      expect.objectContaining({ ticketId: 9, accion: "CREACION" }),
      expect.objectContaining({ transaction: expect.any(Object) }),
    );
    expect(resultado.codigo).toBe("TI-0012");
  });

  test("rechaza una fecha tentativa anterior al inicio", async () => {
    await expect(
      service.crear({
        data: {
          titulo: "Solicitud con fechas inválidas",
          descripcion: "La fecha tentativa quedó antes del inicio.",
          tipo: "Soporte",
          proyecto: "RVE",
          areaSolicitante: "Ventas",
          prioridad: "Media",
          fechaInicio: "2026-09-20",
          fechaEstimada: "2026-09-19",
        },
        files: [],
        user: { id: 4, permisos: ["Ventas"] },
      }),
    ).rejects.toMatchObject({ status: 400, code: "VALIDACION" });
    expect(sequelize.transaction).not.toHaveBeenCalled();
  });

  test("pasa a producción con fecha real y registra el cambio en historial", async () => {
    const ticket = {
      id: 21,
      estado: "Pruebas",
      solicitanteId: 4,
      motivoEstado: null,
      fechaFinalizacion: null,
      version: 3,
      update: jest.fn(async function update(valores) {
        Object.assign(this, valores);
      }),
    };
    const detalle = {
      get: () => ({
        id: 21,
        codigo: "TI-0021",
        estado: "Producción",
        solicitanteId: 4,
        fechaFinalizacion: ticket.fechaFinalizacion,
        archivos: [],
        comentarios: [],
        historial: [],
      }),
    };
    SistemaTicket.findByPk
      .mockResolvedValueOnce(ticket)
      .mockResolvedValueOnce(detalle);
    SistemaTicketArchivo.count.mockResolvedValue(1);
    SistemaTicketComentario.count.mockResolvedValue(0);
    SistemaTicketHistorial.create.mockResolvedValue({ id: 2 });

    const resultado = await service.actualizar({
      ticketId: 21,
      data: { estado: "Producción" },
      user: { id: 8, permisos: ["Sistemas"] },
    });

    expect(ticket.update).toHaveBeenCalledWith(
      expect.objectContaining({
        estado: "Producción",
        fechaFinalizacion: expect.any(Date),
        ultimaModificacionUsuarioId: 8,
        version: 4,
      }),
      expect.objectContaining({ transaction: expect.any(Object) }),
    );
    expect(SistemaTicketHistorial.create).toHaveBeenCalledWith(
      expect.objectContaining({
        accion: "CAMBIO_ESTADO",
        cambios: expect.objectContaining({
          estado: { anterior: "Pruebas", nuevo: "Producción" },
        }),
      }),
      expect.objectContaining({ transaction: expect.any(Object) }),
    );
    expect(resultado.ticket.estado).toBe("Producción");
  });
});
