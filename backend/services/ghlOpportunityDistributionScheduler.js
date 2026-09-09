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
  if (row.modo === "all") return row.hora === local.time;

  const start = minutesOf(row.hora);
  const current = minutesOf(local.time);
  if (start === null || current === null || current < start) return false;
  const interval = Math.min(60, Math.max(1, Number(row.intervaloMinutos) || 1));
  return (current - start) % interval === 0;
}

async function tick(now = new Date()) {
  await service.recoverStaleRuns();
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
}
async function start() {
  if (task) return task;
  await service.recoverStaleRuns();
  task = cron.schedule("* * * * *", () => tick().catch((error) => console.error("Fallo scheduler GHL", { message: service.sanitize(error.message) })), { timezone: service.TIME_ZONE });
  console.log("Scheduler de reparto GHL iniciado", { timezone: service.TIME_ZONE });
  return task;
}
module.exports = { minutesOf, shouldRunConfiguration, tick, start };
