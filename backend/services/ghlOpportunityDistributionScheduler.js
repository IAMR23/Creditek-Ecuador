const cron = require("node-cron");
const Configuracion = require("../models/GhlRepartoConfiguracion");
const service = require("./ghlOpportunityDistributionService");

let task;
async function tick(now = new Date()) {
  await service.recoverStaleRuns();
  const local = service.localScheduleParts(now);
  const rows = await Configuracion.findAll({ where: { activo: true, hora: local.time } });
  for (const row of rows.filter((item) => item.diasSemana.includes(local.day))) {
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
module.exports = { tick, start };
