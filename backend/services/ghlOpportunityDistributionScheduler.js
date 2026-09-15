const cron = require("node-cron");
const Configuracion = require("../models/GhlRepartoConfiguracion");
const service = require("./ghlOpportunityDistributionService");

let task;

const minutesOf = (time) => {
  const [hour, minute] = String(time || "").split(":").map(Number);
  return Number.isInteger(hour) && Number.isInteger(minute) ? hour * 60 + minute : null;
};

function shouldRunConfiguration(row, local) {
  if (!row.diasSemana.includes(local.day)) return false;
  if (row.modo !== "unassigned") return row.hora === local.time;

  const start = minutesOf(row.hora);
  const current = minutesOf(local.time);
  if (start === null || current === null || current < start) return false;
  const interval = Math.min(60, Math.max(1, Number(row.intervaloMinutos) || 1));
  return (current - start) % interval === 0;
}

async function tick(now = new Date()) {
  console.log("[GHL-DEBUG]", {
    paso: "SCHEDULER_TICK_START",
    horaRecibida: now.toISOString(),
  });
  await service.recoverStaleRuns();
  try {
    console.log("[GHL-DEBUG]", {
      paso: "SCHEDULER_REALTIME_QUEUE_START",
      trigger: "scheduler",
    });
    const realtimeResult = await service.executeRealtimeQueue({ trigger: "scheduler" });
    console.log("[GHL-DEBUG]", {
      paso: "SCHEDULER_REALTIME_QUEUE_RESULT",
      code: realtimeResult.code,
      assigned: realtimeResult.assigned,
      assignedCount: realtimeResult.assignedCount,
      errorCount: realtimeResult.errorCount,
      pendingCount: realtimeResult.pendingCount,
      trigger: realtimeResult.trigger,
    });
  } catch (error) {
    console.log("[GHL-DEBUG]", {
      paso: "SCHEDULER_REALTIME_QUEUE_ERROR",
      code: error.code,
      message: error.message,
      statusCode: error.statusCode,
      upstreamStatus: error.upstreamStatus,
      responseStatus: error.response?.status,
    });
    console.error("Fallo respaldo de cola GHL de tiempo real", {
      code: error.code || "GHL_REALTIME_QUEUE_ERROR",
      message: service.sanitize(error.message),
    });
  }
  const local = service.localScheduleParts(now);
  const rows = await Configuracion.findAll({ where: { activo: true } });
  for (const row of rows.filter((item) => shouldRunConfiguration(item, local))) {
    try {
      const result = await service.execute(row, { type: "scheduled", scheduledFor: now, window: local.window });
      console.log("Reparto GHL programado finalizado", { configuracionId: row.id, ejecucionId: result.id, skipped: Boolean(result.skipped) });
    } catch (error) {
      console.error("Fallo reparto GHL programado", { configuracionId: row.id, code: error.code, message: service.sanitize(error.message) });
    }
  }
  console.log("[GHL-DEBUG]", {
    paso: "SCHEDULER_TICK_END",
    horaRecibida: now.toISOString(),
  });
}
async function start() {
  if (task) return task;
  await service.recoverStaleRuns();
  task = cron.schedule("* * * * *", () => tick().catch((error) => console.error("Fallo scheduler GHL", { message: service.sanitize(error.message) })), { timezone: service.TIME_ZONE });
  console.log("Scheduler de reparto GHL iniciado", { timezone: service.TIME_ZONE });
  return task;
}
module.exports = { minutesOf, shouldRunConfiguration, tick, start };
