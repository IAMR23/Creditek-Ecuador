jest.mock("./ghlAdvisorAvailabilityService", () => ({
  resolveConfiguredAdvisors: jest.fn(async (configuredUsers) => ({
    active: configuredUsers,
    paused: [],
    invalid: [],
  })),
  isGhlUserActiveToday: jest.fn(async () => true),
}));

const {
  buildAssignments,
  eligibleOpportunities,
  classifyCurrentOpportunity,
  executionState,
  localScheduleParts,
  opportunityDateRange,
  preview,
  requestWithRetry,
  acquireLock,
  releaseLock,
  recoverStaleRuns,
  sanitize,
  uniqueUsers,
} = require("./ghlOpportunityDistributionService");
const ghl = require("./ghlService");
const advisorAvailability = require("./ghlAdvisorAvailabilityService");
const { sequelize } = require("../config/db");
const Ejecucion = require("../models/GhlRepartoEjecucion");

const users = ["u1", "u2", "u3", "u4", "u5"].map((id) => ({ id, name: id }));
const opportunities = (amount) => Array.from({ length: amount }, (_, index) => ({ id: `o${String(index).padStart(3, "0")}`, createdAt: `2026-01-01T00:${String(index % 60).padStart(2, "0")}:00Z` }));
const counts = (assignments, selectedUsers) => selectedUsers.map((user) => assignments.filter((item) => item.user.id === user.id).length);

describe("reparto determinista de oportunidades GHL", () => {
  beforeEach(() => jest.clearAllMocks());

  test("maneja cero oportunidades", () => expect(buildAssignments([], users.slice(0, 2))).toEqual([]));
  test("maneja menos oportunidades que usuarios", () => expect(counts(buildAssignments(opportunities(2), users), users)).toEqual([1, 1, 0, 0, 0]));
  test("reparte una division exacta", () => expect(counts(buildAssignments(opportunities(10), users), users)).toEqual([2, 2, 2, 2, 2]));
  test("reparte el residuo con diferencia maxima de uno", () => expect(counts(buildAssignments(opportunities(103), users), users)).toEqual([21, 21, 21, 20, 20]));
  test("rota quien recibe el primer sobrante", () => expect(counts(buildAssignments(opportunities(7), users, 2), users)).toEqual([1, 1, 2, 2, 1]));
  test("mantiene reparto equilibrado al pausar y reactivar asesores", () => {
    const reduced = [users[0], users[2]];
    expect(counts(buildAssignments(opportunities(5), reduced, 1), reduced)).toEqual([2, 3]);
    expect(counts(buildAssignments(opportunities(6), users.slice(0, 3), 2), users.slice(0, 3))).toEqual([2, 2, 2]);
  });
  test("elimina usuarios duplicados conservando orden", () => expect(uniqueUsers([users[0], users[0], users[1]]).map((u) => u.id)).toEqual(["u1", "u2"]));
  test("permite repartir a un solo asesor activo", () => expect(counts(buildAssignments(opportunities(3), [users[0]]), [users[0]])).toEqual([3]));
  test("rechaza un reparto sin asesores activos", () => expect(() => buildAssignments(opportunities(1), [])).toThrow("No hay asesores"));
  test("ordena establemente por fecha y luego ID", () => {
    const result = buildAssignments([{ id: "b", createdAt: "2026-02-01" }, { id: "c", createdAt: "2026-01-01" }, { id: "a", createdAt: "2026-02-01" }], users.slice(0, 2));
    expect(result.map((item) => item.opportunity.id)).toEqual(["c", "a", "b"]);
  });
  test("solo sin propietario excluye asignadas", () => expect(eligibleOpportunities([{ id: "a" }, { id: "b", assignedTo: "u1" }], "unassigned").map((o) => o.id)).toEqual(["a"]));
  test("redistribuir todas incluye asignadas", () => expect(eligibleOpportunities([{ id: "a" }, { id: "b", assignedTo: "u1" }], "all")).toHaveLength(2));
  test("calcula dia y hora en America/Guayaquil", () => expect(localScheduleParts(new Date("2026-09-07T14:05:00Z"))).toMatchObject({ day: 1, time: "09:05", window: "2026-09-07T09:05" }));
  test("limita oportunidades a hoy y maximo un dia antes en Guayaquil", () => expect(opportunityDateRange(new Date("2026-09-07T04:30:00Z"))).toEqual({ fechaInicio: "2026-09-05", fechaFin: "2026-09-06" }));
  test("sanitiza tokens antes de persistir errores", () => expect(sanitize("Authorization Bearer abc.def token=secreto")).not.toMatch(/abc|secreto/));

  test("omite una oportunidad que cambio de etapa", () => expect(classifyCurrentOpportunity({ pipelineId: "p", pipelineStageId: "otra" }, { pipelineId: "p", stageId: "s", modo: "all" })).toBe("STAGE_CHANGED"));
  test("omite una oportunidad asignada manualmente durante modo sin propietario", () => expect(classifyCurrentOpportunity({ pipelineId: "p", pipelineStageId: "s", assignedTo: "u9" }, { pipelineId: "p", stageId: "s", modo: "unassigned" })).toBe("OWNER_CHANGED"));
  test("un error parcial conserva las asignaciones exitosas", () => expect(executionState(4, 1)).toBe("partial"));
  test("una misma fecha genera la misma ventana idempotente", () => {
    const date = new Date("2026-09-07T14:05:45Z");
    expect(localScheduleParts(date).window).toBe(localScheduleParts(date).window);
  });

  test("preview consulta pero nunca escribe en GHL", async () => {
    const client = { request: jest.fn() };
    jest.spyOn(ghl, "getGhlConfig").mockReturnValue({ locationId: "l" });
    jest.spyOn(ghl, "createGhlClient").mockReturnValue(client);
    jest.spyOn(ghl, "fetchOpportunitiesByStatus").mockResolvedValue([{ id: "o1", pipelineId: "p", pipelineStageId: "s" }]);
    jest.spyOn(ghl, "fetchAllAssignableUsers").mockResolvedValue(users.slice(0, 2));
    const result = await preview({ pipelineId: "p", stageId: "s", modo: "all", usuariosGhl: users.slice(0, 2), indiceSiguienteUsuario: 0 });
    expect(result.totalElegibles).toBe(1);
    expect(client.request).not.toHaveBeenCalled();
    expect(ghl.fetchOpportunitiesByStatus).toHaveBeenCalledWith(client, expect.anything(), "open", expect.objectContaining({ fechaInicio: expect.any(String), fechaFin: expect.any(String) }));
    jest.restoreAllMocks();
  });

  test("preview conserva pendientes y advierte cuando todos estan pausados", async () => {
    const client = { request: jest.fn() };
    jest.spyOn(ghl, "getGhlConfig").mockReturnValue({ locationId: "l" });
    jest.spyOn(ghl, "createGhlClient").mockReturnValue(client);
    jest.spyOn(ghl, "fetchOpportunitiesByStatus").mockResolvedValue([
      { id: "o1", pipelineId: "p", pipelineStageId: "s" },
    ]);
    jest.spyOn(ghl, "fetchAllAssignableUsers").mockResolvedValue(users.slice(0, 2));
    advisorAvailability.resolveConfiguredAdvisors.mockResolvedValueOnce({
      active: [],
      paused: users.slice(0, 2),
      invalid: [],
    });

    const result = await preview({
      pipelineId: "p",
      stageId: "s",
      modo: "unassigned",
      usuariosGhl: users.slice(0, 2),
      indiceSiguienteUsuario: 0,
    });

    expect(result).toMatchObject({
      totalElegibles: 1,
      usuariosActivos: 0,
      usuariosPausados: 2,
      advertencia: expect.stringContaining("sin propietario"),
    });
    expect(ghl.fetchOpportunitiesByStatus).toHaveBeenCalledWith(
      client,
      expect.anything(),
      "open",
      {},
    );
    expect(client.request).not.toHaveBeenCalled();
  });

  test("una oportunidad pendiente se reparte en la siguiente consulta cuando aparece Play", async () => {
    const client = { request: jest.fn() };
    jest.spyOn(ghl, "getGhlConfig").mockReturnValue({ locationId: "l" });
    jest.spyOn(ghl, "createGhlClient").mockReturnValue(client);
    jest.spyOn(ghl, "fetchOpportunitiesByStatus").mockResolvedValue([
      { id: "o-pendiente", pipelineId: "p", pipelineStageId: "s" },
    ]);
    jest.spyOn(ghl, "fetchAllAssignableUsers").mockResolvedValue(users.slice(0, 2));
    advisorAvailability.resolveConfiguredAdvisors
      .mockResolvedValueOnce({ active: [], paused: users.slice(0, 2), invalid: [] })
      .mockResolvedValueOnce({ active: users.slice(0, 2), paused: [], invalid: [] });
    const config = { pipelineId: "p", stageId: "s", modo: "unassigned", usuariosGhl: users.slice(0, 2), indiceSiguienteUsuario: 0 };

    const first = await preview(config);
    const second = await preview(config);

    expect(first.usuarios).toHaveLength(0);
    expect(second.usuarios.reduce((total, user) => total + user.cantidad, 0)).toBe(1);
    expect(ghl.fetchOpportunitiesByStatus).toHaveBeenCalledTimes(2);
  });

  test("429 respeta reintento limitado y Retry-After", async () => {
    const limited = Object.assign(new Error("limit"), { upstreamStatus: 429, retryAfterMs: 0 });
    jest.spyOn(ghl, "requestGhl").mockRejectedValueOnce(limited).mockResolvedValueOnce({ ok: true });
    await expect(requestWithRetry({}, { method: "PUT" }, 1)).resolves.toEqual({ ok: true });
    expect(ghl.requestGhl).toHaveBeenCalledTimes(2);
    jest.restoreAllMocks();
  });

  test("el advisory lock impide dos ejecuciones simultaneas", async () => {
    const firstConnection = { query: jest.fn().mockResolvedValue({ rows: [{ locked: true }] }) };
    const secondConnection = { query: jest.fn().mockResolvedValue({ rows: [{ locked: false }] }) };
    jest.spyOn(sequelize.connectionManager, "getConnection").mockResolvedValueOnce(firstConnection).mockResolvedValueOnce(secondConnection);
    jest.spyOn(sequelize.connectionManager, "releaseConnection").mockResolvedValue();
    const first = await acquireLock(7);
    const second = await acquireLock(7);
    expect(first).toBe(firstConnection);
    expect(second).toBeNull();
    await releaseLock(first, 7);
    expect(firstConnection.query).toHaveBeenLastCalledWith("SELECT pg_advisory_unlock(hashtext($1))", ["ghl-reparto:7"]);
    jest.restoreAllMocks();
  });

  test("al reiniciar recupera ejecuciones antiguas solo si el lock esta libre", async () => {
    const run = { id: 9, configuracionId: 9, estado: "running", heartbeatAt: new Date(0), startedAt: new Date(0), totalEncontradas: 0, totalElegibles: 0, update: jest.fn(async (values) => Object.assign(run, values)), reload: jest.fn(async () => run) };
    const connection = { query: jest.fn().mockResolvedValueOnce({ rows: [{ locked: true }] }).mockResolvedValueOnce({ rows: [{ pg_advisory_unlock: true }] }) };
    jest.spyOn(Ejecucion, "findAll").mockResolvedValue([run]);
    jest.spyOn(Ejecucion, "findByPk").mockResolvedValue(run);
    jest.spyOn(sequelize, "transaction").mockImplementation(async (callback) => callback({ LOCK: { UPDATE: "UPDATE" } }));
    const Detalle = require("../models/GhlRepartoEjecucionDetalle");
    jest.spyOn(Detalle, "update").mockResolvedValue([0]);
    jest.spyOn(Detalle, "findAll").mockResolvedValue([]);
    jest.spyOn(sequelize.connectionManager, "getConnection").mockResolvedValue(connection);
    jest.spyOn(sequelize.connectionManager, "releaseConnection").mockResolvedValue();
    await recoverStaleRuns();
    expect(run.update).toHaveBeenCalledWith(expect.objectContaining({ estado: "interrupted", finishedAt: expect.any(Date) }));
    jest.restoreAllMocks();
  });
});
