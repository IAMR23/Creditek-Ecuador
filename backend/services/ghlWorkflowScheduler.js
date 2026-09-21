const cron = require("node-cron");
const Programacion = require("../models/GhlWorkflowProgramacion");
const executionService = require("./ghlWorkflowExecutionService");
const configurationService = require("./ghlWorkflowConfigurationService");

let task;

async function tick(now = new Date()) {
  await executionService.recoverStaleRuns(now);
  const rows = await Programacion.findAll({ where: { activo: true }, order: [["id", "ASC"]] });
  for (const row of rows) {
    try {
      await executionService.executeScheduled(row, now);
    } catch (error) {
      console.error("[GHL_WORKFLOW] SCHEDULE_ERROR", {
        configuracionId: row.id,
        codigo: error.code || "GHL_WORKFLOW_SCHEDULE_ERROR",
        mensaje: configurationService.sanitize(error.message),
      });
    }
  }
}

async function start() {
  if (task) return task;
  await executionService.recoverStaleRuns();
  task = cron.schedule("* * * * *", () => tick().catch((error) => {
    console.error("[GHL_WORKFLOW] SCHEDULER_ERROR", {
      codigo: error.code || "GHL_WORKFLOW_SCHEDULER_ERROR",
      mensaje: configurationService.sanitize(error.message),
    });
  }), { timezone: configurationService.TIME_ZONE });
  console.log("Scheduler de workflows GHL iniciado", { timezone: configurationService.TIME_ZONE });
  return task;
}

module.exports = { tick, start };
