const cron = require("node-cron");
const Configuracion = require("../models/GhlRepartoConfiguracion");
const service = require("./ghlOpportunityDistributionService");
const advisorAvailability = require("./ghlAdvisorAvailabilityService");

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
  try {
    await advisorAvailability.pauseAllActiveAdvisors({ now });
  } catch (error) {
    console.error("Fallo pausa automatica de asesores GHL", {
      code: error.code || "GHL_AUTO_PAUSE_ERROR",
      message: service.sanitize(error.message),
    });
  }
  await service.recoverStaleRuns();
  await service.recoverPendingRealtimeQueueReviews();
  let queueResult;
  try {
    queueResult = await service.executeRealtimeQueue({ trigger: "scheduler" });
  } catch {}
  if ([
    "PREVIOUS_EXECUTION_RUNNING",
    "GHL_REPARTO_SUSPENDED",
    "QUEUE_FAILED",
    "QUEUE_PARTIAL",
  ].includes(queueResult?.code)) return queueResult;
  const local = service.localScheduleParts(now);
  const rows = await Configuracion.findAll({ where: { activo: true } });
  for (const row of rows.filter((item) => shouldRunConfiguration(item, local))) {
    try {
      const result = await service.execute(row, { type: "scheduled", scheduledFor: now, window: local.window });
      if (result?.code === "PREVIOUS_EXECUTION_RUNNING") return result;
    } catch (error) {
      console.error("Fallo reparto GHL programado", { configuracionId: row.id, code: error.code, message: service.sanitize(error.message) });
    }
  }
}
async function start() {
  if (task) return task;
  await service.recoverStaleRuns();
  await service.recoverPendingRealtimeQueueReviews();
  task = cron.schedule("* * * * *", () => tick().catch((error) => console.error("Fallo scheduler GHL", { message: service.sanitize(error.message) })), { timezone: service.TIME_ZONE });
  console.log("Scheduler de reparto GHL iniciado", { timezone: service.TIME_ZONE });
  return task;
}
module.exports = { minutesOf, shouldRunConfiguration, tick, start };
