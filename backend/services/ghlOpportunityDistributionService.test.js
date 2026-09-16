jest.mock("./ghlAdvisorAvailabilityService", () => ({
  resolveConfiguredAdvisors: jest.fn(async (configuredUsers) => ({
    active: configuredUsers,
    paused: [],
    invalid: [],
  })),
  resolveActiveAdvisors: jest.fn(async (currentUsers) => ({
    active: currentUsers,
    paused: [],
    invalid: [],
  })),
  isGhlUserActiveToday: jest.fn(async () => true),
}));

const {
  buildAssignments,
  buildCapacityAssignments,
  currentLoadsByAdvisor,
  eligibleOpportunities,
  classifyCurrentOpportunity,
  executionState,
  localScheduleParts,
  opportunityDateRange,
  opportunityTodayRange,
  preview,
  validateInput,
  requestWithRetry,
  acquireLock,
  releaseLock,
  recoverStaleRuns,
  sanitize,
  uniqueUsers,
  lockScopeForConfiguration,
  REALTIME_LOCK_SCOPE,
  realtimeStageChannel,
  realtimeMaxPendingPerAdvisor,
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
  afterEach(() => jest.useRealTimers());

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
  test("dos asesores con limite 10 reciben solo 10 de una cola de 100", () => {
    const result = buildCapacityAssignments(opportunities(100), users.slice(0, 2), new Map(), 10, 0);
    expect(counts(result.assignments, users.slice(0, 2))).toEqual([10, 10]);
    expect(result.totalPendientesCapacidad).toBe(80);
  });
  test("asesores nuevos con carga cero reciben antes que quienes ya tienen diez", () => {
    const loads = new Map([["u1", 10], ["u2", 10], ["u3", 0], ["u4", 0]]);
    const result = buildCapacityAssignments(opportunities(80), users.slice(0, 4), loads, 10, 0);
    expect(counts(result.assignments, users.slice(0, 4))).toEqual([0, 0, 10, 10]);
    expect(result.totalPendientesCapacidad).toBe(60);
  });
  test("un asesor con carga ocho recibe como maximo dos", () => {
    const result = buildCapacityAssignments(opportunities(20), [users[0]], new Map([["u1", 8]]), 10, 0);
    expect(result.assignments).toHaveLength(2);
    expect(result.advisors[0]).toMatchObject({ cargaActual: 8, capacidadDisponible: 2, cantidadPlanificada: 2, cargaResultante: 10 });
  });
  test("todos los asesores al limite conservan toda la cola", () => {
    const result = buildCapacityAssignments(opportunities(12), users.slice(0, 2), new Map([["u1", 10], ["u2", 10]]), 10, 0);
    expect(result.assignments).toHaveLength(0);
    expect(result.totalPendientesCapacidad).toBe(12);
  });
  test("empates de carga respetan indiceSiguienteUsuario", () => {
    const result = buildCapacityAssignments(opportunities(1), users.slice(0, 3), new Map(), 10, 2);
    expect(result.assignments[0].user.id).toBe("u3");
    expect(result.nextUserIndex).toBe(0);
  });
  test("calcula la carga solo con propietarios configurados dentro de la consulta", () => {
    const loads = currentLoadsByAdvisor([
      { id: "o1", assignedTo: "u1" }, { id: "o2", ownerId: "u1" }, { id: "o3", assignedTo: "externo" }, { id: "o4" },
    ], users.slice(0, 2));
    expect(Object.fromEntries(loads)).toEqual({ u1: 2, u2: 0 });
  });
  test("todos los puntos de entrada comparten el bloqueo por locationId", () => {
    expect(lockScopeForConfiguration({ id: 1, modo: "unassigned" }, "location-1"))
      .toBe("location:location-1");
    expect(lockScopeForConfiguration({ id: 2, modo: "all" }, "location-1"))
      .toBe("location:location-1");
    expect(lockScopeForConfiguration({ id: 3, modo: "refresh_non_management" }, "location-2"))
      .toBe("location:location-2");
  });
  test("reconoce las etapas WhatsApp y Facebook por su nombre actual", () => {
    expect(realtimeStageChannel({ name: "Nuevos - Whats App" })).toBe("whatsapp");
    expect(realtimeStageChannel({ name: "Leads Facebook" })).toBe("facebook");
    expect(realtimeStageChannel({ name: "Gestion" })).toBeNull();
  });
  test("el limite de tiempo real usa 10 por defecto y acepta configuracion de entorno", () => {
    expect(realtimeMaxPendingPerAdvisor({})).toBe(10);
    expect(realtimeMaxPendingPerAdvisor({ GHL_REPARTO_MAX_PENDIENTES_POR_ASESOR: "15" })).toBe(15);
    expect(realtimeMaxPendingPerAdvisor({ GHL_REPARTO_MAX_PENDIENTES_POR_ASESOR: "0" })).toBe(10);
  });
  test("solo sin propietario excluye asignadas", () => expect(eligibleOpportunities([{ id: "a" }, { id: "b", assignedTo: "u1" }], "unassigned").map((o) => o.id)).toEqual(["a"]));
  test("redistribuir todas incluye asignadas", () => expect(eligibleOpportunities([{ id: "a" }, { id: "b", assignedTo: "u1" }], "all")).toHaveLength(2));
  test("calcula dia y hora en America/Guayaquil", () => expect(localScheduleParts(new Date("2026-09-07T14:05:00Z"))).toMatchObject({ day: 1, time: "09:05", window: "2026-09-07T09:05" }));
  test("limita oportunidades a hoy y maximo un dia antes en Guayaquil", () => expect(opportunityDateRange(new Date("2026-09-07T04:30:00Z"))).toEqual({ fechaInicio: "2026-09-05", fechaFin: "2026-09-06" }));
  test("el refresco limita oportunidades exclusivamente al dia local", () => expect(opportunityTodayRange(new Date("2026-09-07T04:30:00Z"))).toEqual({ fechaInicio: "2026-09-06", fechaFin: "2026-09-06" }));
  test("sanitiza tokens antes de persistir errores", () => expect(sanitize("Authorization Bearer abc.def token=secreto")).not.toMatch(/abc|secreto/));

  test("omite una oportunidad que cambio de etapa", () => expect(classifyCurrentOpportunity({ pipelineId: "p", pipelineStageId: "otra" }, { pipelineId: "p", stageId: "s", modo: "all" })).toBe("STAGE_CHANGED"));
  test("el refresco acepta etapas distintas y excluye Gestion", () => {
    const config = { pipelineId: "p", stageId: "gestion", modo: "refresh_non_management" };
    expect(classifyCurrentOpportunity({ pipelineId: "p", pipelineStageId: "contactado" }, config)).toBeNull();
    expect(classifyCurrentOpportunity({ pipelineId: "p", pipelineStageId: "gestion" }, config)).toBe("STAGE_CHANGED");
  });
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

  test("preview calcula carga, capacidad, plan y cola restante", async () => {
    const client = { request: jest.fn() };
    jest.spyOn(ghl, "getGhlConfig").mockReturnValue({ locationId: "l" });
    jest.spyOn(ghl, "createGhlClient").mockReturnValue(client);
    jest.spyOn(ghl, "fetchOpportunitiesByStatus").mockResolvedValue([
      ...opportunities(15).map((item) => ({ ...item, pipelineId: "p", pipelineStageId: "s" })),
      ...opportunities(8).map((item, index) => ({ ...item, id: `a${index}`, pipelineId: "p", pipelineStageId: "s", assignedTo: "u1" })),
    ]);
    jest.spyOn(ghl, "fetchAllAssignableUsers").mockResolvedValue(users.slice(0, 2));
    advisorAvailability.resolveConfiguredAdvisors.mockResolvedValueOnce({ active: users.slice(0, 2), paused: [], invalid: [] });

    const result = await preview({
      pipelineId: "p", stageId: "s", modo: "unassigned", usuariosGhl: users.slice(0, 2),
      indiceSiguienteUsuario: 0, maxPendientesPorAsesor: 10,
    });

    expect(result).toMatchObject({
      totalEncontradas: 23,
      totalSinPropietario: 15,
      totalPorAsignar: 12,
      totalPendientesCapacidad: 3,
    });
    expect(result.usuarios.map((user) => ({ id: user.id, carga: user.cargaActual, plan: user.cantidadPlanificada })))
      .toEqual([{ id: "u1", carga: 8, plan: 2 }, { id: "u2", carga: 0, plan: 10 }]);
    expect(client.request).not.toHaveBeenCalled();
  });

  test.each([0, -1, 1.5, 1001])("rechaza limite de pendientes invalido: %p", async (maxPendientesPorAsesor) => {
    jest.spyOn(ghl, "getGhlConfig").mockReturnValue({ locationId: "l" });
    jest.spyOn(ghl, "createGhlClient").mockReturnValue({ request: jest.fn() });
    jest.spyOn(ghl, "fetchPipelines").mockResolvedValue([{ id: "pipeline", name: "Pipeline", stages: [{ id: "stage", name: "Etapa" }] }]);
    jest.spyOn(ghl, "fetchAllAssignableUsers").mockResolvedValue(users.slice(0, 2));
    await expect(validateInput({
      nombre: "Prueba", pipelineId: "pipeline", stageId: "stage", hora: "09:00", diasSemana: [1],
      modo: "unassigned", usuariosGhl: users.slice(0, 2), maxPendientesPorAsesor,
    })).rejects.toMatchObject({ code: "INVALID_MAX_PENDING", statusCode: 400 });
    jest.restoreAllMocks();
  });

  test("preview de refresco usa todos los asesores en Play y excluye Gestion", async () => {
    const client = { request: jest.fn() };
    jest.spyOn(ghl, "getGhlConfig").mockReturnValue({ locationId: "l" });
    jest.spyOn(ghl, "createGhlClient").mockReturnValue(client);
    jest.spyOn(ghl, "fetchAllOpportunityStatuses").mockResolvedValue([
      { id: "o1", pipelineId: "p", pipelineStageId: "contactado" },
      { id: "o2", pipelineId: "p", pipelineStageId: "gestion" },
    ]);
    jest.spyOn(ghl, "fetchAllAssignableUsers").mockResolvedValue(users.slice(0, 2));

    const result = await preview({
      pipelineId: "p",
      stageId: "gestion",
      modo: "refresh_non_management",
      usuariosGhl: [],
      indiceSiguienteUsuario: 0,
    });

    expect(result.totalEncontradas).toBe(1);
    expect(result.totalElegibles).toBe(1);
    expect(result.usuariosActivos).toBe(2);
    expect(advisorAvailability.resolveActiveAdvisors).toHaveBeenCalled();
    expect(ghl.fetchAllOpportunityStatuses).toHaveBeenCalledWith(client, expect.anything(), {
      fechaInicio: expect.any(String),
      fechaFin: expect.any(String),
    });
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
    jest.useFakeTimers();
    const limited = Object.assign(new Error("limit"), { upstreamStatus: 429, retryAfterMs: 2500 });
    jest.spyOn(ghl, "requestGhl").mockRejectedValueOnce(limited).mockResolvedValueOnce({ ok: true });
    const result = requestWithRetry({}, { method: "PUT" }, 1);
    await Promise.resolve();
    expect(ghl.requestGhl).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(2499);
    expect(ghl.requestGhl).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(1);
    await expect(result).resolves.toEqual({ ok: true });
    expect(ghl.requestGhl).toHaveBeenCalledTimes(2);
    jest.useRealTimers();
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
    jest.spyOn(ghl, "getGhlConfig").mockReturnValue({ locationId: "location-1" });
    await recoverStaleRuns();
    expect(run.update).toHaveBeenCalledWith(expect.objectContaining({ estado: "interrupted", finishedAt: expect.any(Date) }));
    jest.restoreAllMocks();
  });
});
