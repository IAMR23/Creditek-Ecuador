const { sequelize } = require("../config/db");
const Usuario = require("../models/Usuario");
const Vinculo = require("../models/GhlAsesorVinculo");
const Historial = require("../models/GhlAsesorDisponibilidadHistorial");
const Detalle = require("../models/GhlRepartoEjecucionDetalle");
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
});

afterEach(() => jest.restoreAllMocks());

describe("disponibilidad diaria de asesores GHL", () => {
  test("un Play del dia anterior se considera pausado", () => {
    const row = makeLink({ estadoRecepcion: "ACTIVO", estadoFechaLocal: "2026-09-08" });
    expect(service.effectiveState(row, NOW)).toBe("PAUSADO");
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
});
