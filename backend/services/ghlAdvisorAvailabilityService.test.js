const { sequelize } = require("../config/db");
const Usuario = require("../models/Usuario");
const Vinculo = require("../models/GhlAsesorVinculo");
const Historial = require("../models/GhlAsesorDisponibilidadHistorial");
const Detalle = require("../models/GhlRepartoEjecucionDetalle");
const TiempoRealAsignacion = require("../models/GhlRepartoTiempoRealAsignacion");
const ghl = require("./ghlService");
const service = require("./ghlAdvisorAvailabilityService");

const NOW = new Date("2026-09-09T15:00:00.000Z");

const makeLink = (overrides = {}) => {
  const row = {
    id: 1,
    usuarioId: 10,
    ghlUserId: "ghl-10",
    ghlNombre: "Ana GHL",
    ghlEmail: "ana@example.com",
    activo: true,
    estadoRecepcion: "PAUSADO",
    estadoFechaLocal: null,
    estadoCambiadoAt: null,
    update: jest.fn(async (values) => { Object.assign(row, values); return row; }),
    ...overrides,
  };
  return row;
};

beforeEach(() => {
  jest.spyOn(sequelize, "transaction").mockImplementation(async (callback) =>
    callback({ LOCK: { UPDATE: "UPDATE" } }),
  );
  jest.spyOn(Detalle, "findAll").mockResolvedValue([]);
  jest.spyOn(TiempoRealAsignacion, "findAll").mockResolvedValue([]);
});

afterEach(() => jest.restoreAllMocks());

describe("disponibilidad diaria de asesores GHL", () => {
  test("identifica solamente el cargo exacto VENDEDOR CALL CENTER", () => {
    expect(service.isVendedorCallCenterCargo("  vendedor   call center ")).toBe(true);
    expect(service.isVendedorCallCenterCargo("SUPERVISOR DE CALL CENTER")).toBe(false);
    expect(service.isVendedorCallCenterCargo("JEFE COMERCIAL DE CALL CENTER")).toBe(false);
    expect(service.isVendedorCallCenterCargo("VENDEDOR DE PISO")).toBe(false);
  });

  test("oculta la disponibilidad a usuarios con otro cargo", async () => {
    jest.spyOn(Usuario, "findOne").mockResolvedValue({
      id: 10,
      rolPago: { cargo: "SUPERVISOR DE CALL CENTER" },
      rolesPago: [],
    });
    const findLink = jest.spyOn(Vinculo, "findOne");

    const result = await service.getMyAvailability(10, NOW);

    expect(result).toMatchObject({
      aplicaRepartoGhl: false,
      vinculado: false,
      recibiendoLeads: false,
    });
    expect(findLink).not.toHaveBeenCalled();
  });

  test("muestra la disponibilidad a quien tiene VENDEDOR CALL CENTER como cargo adicional", async () => {
    jest.spyOn(Usuario, "findOne").mockResolvedValue({
      id: 10,
      rolPago: { cargo: "ASISTENTE ADMINISTRATIVO" },
      rolesPago: [{ cargo: "VENDEDOR CALL CENTER" }],
    });
    jest.spyOn(Vinculo, "findOne").mockResolvedValue(null);

    const result = await service.getMyAvailability(10, NOW);

    expect(result).toMatchObject({
      aplicaRepartoGhl: true,
      vinculado: false,
    });
  });

  test("un Play del dia anterior se considera pausado", () => {
    const row = makeLink({ estadoRecepcion: "ACTIVO", estadoFechaLocal: "2026-09-08" });
    expect(service.effectiveState(row, NOW)).toBe("PAUSADO");
  });

  test("el conteo diario combina asignaciones programadas y de tiempo real", async () => {
    Detalle.findAll.mockResolvedValue([{ newAssignedTo: "ghl-10", cantidad: "2" }]);
    TiempoRealAsignacion.findAll.mockResolvedValue([{ ghlUserId: "ghl-10", cantidad: "3" }]);

    const counts = await service.countByGhlUserBetween(
      ["ghl-10"],
      new Date("2026-09-09T05:00:00.000Z"),
      new Date("2026-09-10T04:59:59.999Z"),
    );

    expect(counts.get("ghl-10")).toBe(5);
  });

  test("Play persiste estado, fecha local y auditoria", async () => {
    const row = makeLink();
    jest.spyOn(Usuario, "findOne").mockResolvedValue({ id: 10, activo: true });
    jest.spyOn(Vinculo, "findOne").mockResolvedValue(row);
    jest.spyOn(Historial, "create").mockResolvedValue({});
    jest.spyOn(ghl, "getGhlConfig").mockReturnValue({ locationId: "loc" });
    jest.spyOn(ghl, "createGhlClient").mockReturnValue({});
    jest.spyOn(ghl, "fetchAllAssignableUsers").mockResolvedValue([{ id: "ghl-10" }]);

    const result = await service.changeAvailability({
      usuarioId: 10,
      estado: "ACTIVO",
      actorId: 10,
      motivoCambio: "asesor",
      now: NOW,
    });

    expect(row.update).toHaveBeenCalledWith(
      expect.objectContaining({
        estadoRecepcion: "ACTIVO",
        estadoFechaLocal: "2026-09-09",
        motivoUltimoCambio: "asesor",
      }),
      expect.anything(),
    );
    expect(Historial.create).toHaveBeenCalledWith(
      expect.objectContaining({ estadoAnterior: "PAUSADO", estadoNuevo: "ACTIVO" }),
      expect.anything(),
    );
    expect(result.recibiendoLeads).toBe(true);
  });

  test("dos solicitudes de Play concurrentes no duplican auditoria", async () => {
    const row = makeLink();
    jest.spyOn(Usuario, "findOne").mockResolvedValue({ id: 10, activo: true });
    jest.spyOn(Vinculo, "findOne").mockResolvedValue(row);
    const historyCreate = jest.spyOn(Historial, "create").mockResolvedValue({});
    jest.spyOn(ghl, "getGhlConfig").mockReturnValue({ locationId: "loc" });
    jest.spyOn(ghl, "createGhlClient").mockReturnValue({});
    jest.spyOn(ghl, "fetchAllAssignableUsers").mockResolvedValue([{ id: "ghl-10" }]);
    const input = {
      usuarioId: 10,
      estado: "ACTIVO",
      actorId: 10,
      motivoCambio: "asesor",
      now: NOW,
    };

    await Promise.all([
      service.changeAvailability(input),
      service.changeAvailability(input),
    ]);

    expect(historyCreate).toHaveBeenCalledTimes(1);
    expect(row.estadoRecepcion).toBe("ACTIVO");
  });

  test("Pausa no consulta GHL y excluye inmediatamente al asesor", async () => {
    const row = makeLink({ estadoRecepcion: "ACTIVO", estadoFechaLocal: "2026-09-09" });
    jest.spyOn(Vinculo, "findOne").mockResolvedValue(row);
    jest.spyOn(Historial, "create").mockResolvedValue({});
    const fetchUsers = jest.spyOn(ghl, "fetchAllAssignableUsers");

    const result = await service.changeAvailability({
      usuarioId: 10,
      estado: "PAUSADO",
      actorId: 99,
      motivoCambio: "administrador",
      now: NOW,
    });

    expect(fetchUsers).not.toHaveBeenCalled();
    expect(result.estado).toBe("PAUSADO");
    expect(row.estadoFechaLocal).toBeNull();
  });

  test("filtra configurados entre activos, pausados e invalidos", async () => {
    const active = makeLink({ ghlUserId: "g1", estadoRecepcion: "ACTIVO", estadoFechaLocal: "2026-09-09", usuario: { activo: true } });
    const paused = makeLink({ id: 2, ghlUserId: "g2", usuarioId: 11, usuario: { activo: true } });
    jest.spyOn(Vinculo, "findAll").mockResolvedValue([active, paused]);

    const result = await service.resolveConfiguredAdvisors(
      [{ id: "g1" }, { id: "g2" }, { id: "g3" }],
      [{ id: "g1" }, { id: "g2" }, { id: "g3" }],
      NOW,
    );

    expect(result.active.map((user) => user.id)).toEqual(["g1"]);
    expect(result.paused.map((user) => user.id)).toEqual(["g2"]);
    expect(result.invalid.map((user) => user.id)).toEqual(["g3"]);
  });

  test("un asesor se reincorpora al reparto al volver a Play", async () => {
    const row = makeLink({ ghlUserId: "g1", usuario: { activo: true } });
    jest.spyOn(Vinculo, "findAll").mockImplementation(async () => [row]);

    const paused = await service.resolveConfiguredAdvisors(
      [{ id: "g1" }],
      [{ id: "g1" }],
      NOW,
    );
    row.estadoRecepcion = "ACTIVO";
    row.estadoFechaLocal = "2026-09-09";
    const active = await service.resolveConfiguredAdvisors(
      [{ id: "g1" }],
      [{ id: "g1" }],
      NOW,
    );

    expect(paused.paused).toHaveLength(1);
    expect(active.active).toHaveLength(1);
  });

  test("una asociacion administrativa inicia pausada y queda auditada", async () => {
    jest.spyOn(Usuario, "findOne").mockResolvedValue({ id: 10, activo: true });
    jest.spyOn(Vinculo, "findOne").mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    const row = makeLink();
    jest.spyOn(Vinculo, "create").mockResolvedValue(row);
    jest.spyOn(Historial, "create").mockResolvedValue({});
    jest.spyOn(ghl, "getGhlConfig").mockReturnValue({ locationId: "loc" });
    jest.spyOn(ghl, "createGhlClient").mockReturnValue({});
    jest.spyOn(ghl, "fetchAllAssignableUsers").mockResolvedValue([
      { id: "ghl-10", name: "Ana GHL", email: "ana@example.com" },
    ]);

    const result = await service.saveAssociation({
      usuarioId: 10,
      ghlUserId: "ghl-10",
      actorId: 99,
      now: NOW,
    });

    expect(Vinculo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        usuarioId: 10,
        ghlUserId: "ghl-10",
        estadoRecepcion: "PAUSADO",
      }),
      expect.anything(),
    );
    expect(Historial.create).toHaveBeenCalledWith(
      expect.objectContaining({ accion: "ASOCIACION", motivoCambio: "administrador" }),
      expect.anything(),
    );
    expect(result.estado).toBe("PAUSADO");
  });

  test("arma el reporte diario con ultimo Play, descanso y leads", async () => {
    const row = makeLink({
      estadoRecepcion: "ACTIVO",
      estadoFechaLocal: "2026-09-09",
      usuario: { id: 10, nombre: "Ana", email: "ana@example.com", activo: true },
      toJSON() { return { ...this }; },
    });
    jest.spyOn(Vinculo, "findAll").mockResolvedValue([row]);
    jest.spyOn(Historial, "findAll").mockResolvedValue([
      { usuarioId: 10, estadoNuevo: "ACTIVO", createdAt: new Date("2026-09-09T13:00:00.000Z"), cambiadoPorId: 10, motivoCambio: "asesor", cambiadoPor: { nombre: "Ana" } },
      { usuarioId: 10, estadoNuevo: "PAUSADO", createdAt: new Date("2026-09-09T17:00:00.000Z"), cambiadoPorId: 99, motivoCambio: "administrador", cambiadoPor: { nombre: "Supervisor" } },
      { usuarioId: 10, estadoNuevo: "ACTIVO", createdAt: new Date("2026-09-09T18:00:00.000Z"), cambiadoPorId: 10, motivoCambio: "asesor", cambiadoPor: { nombre: "Ana" } },
    ]);
    Detalle.findAll.mockResolvedValue([{ newAssignedTo: "ghl-10", cantidad: "7" }]);

    const result = await service.getAdvisorManagementReport({ fecha: "2026-09-09", now: NOW });

    expect(result).toEqual([
      expect.objectContaining({
        usuarioId: 10,
        nombre: "Ana",
        estado: "ACTIVO",
        momentoPlay: new Date("2026-09-09T18:00:00.000Z"),
        momentoDescanso: new Date("2026-09-09T17:00:00.000Z"),
        leadsGestionados: 7,
        historial: [
          expect.objectContaining({ estado: "ACTIVO", origen: "asesor" }),
          expect.objectContaining({ estado: "PAUSADO", cambiadoPor: "Supervisor" }),
          expect.objectContaining({ estado: "ACTIVO", origen: "asesor" }),
        ],
      }),
    ]);
  });

  test("rechaza fechas invalidas en el reporte", () => {
    expect(() => service.reportDayBounds("2026-02-31")).toThrow("fecha indicada no es valida");
  });

  test("selecciona dinamicamente solo vinculados que dieron Play hoy", async () => {
    const active = makeLink({ ghlUserId: "g1", estadoRecepcion: "ACTIVO", estadoFechaLocal: "2026-09-09", usuario: { id: 10, activo: true } });
    const paused = makeLink({ id: 2, usuarioId: 11, ghlUserId: "g2", usuario: { id: 11, activo: true } });
    jest.spyOn(Vinculo, "findAll").mockResolvedValue([active, paused]);

    const result = await service.resolveActiveAdvisors([
      { id: "g1", name: "Ana" },
      { id: "g2", name: "Luis" },
    ], NOW);

    expect(result.active.map((user) => user.id)).toEqual(["g1"]);
    expect(result.paused.map((user) => user.id)).toEqual(["g2"]);
  });
});
