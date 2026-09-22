const cron = require("node-cron");
const Programacion = require("../models/GhlWorkflowProgramacion");
const executionService = require("./ghlWorkflowExecutionService");
const configurationService = require("./ghlWorkflowConfigurationService");

let task;
const state = {
  started: false,
  startedAt: null,
  lastTickStartedAt: null,
  lastTickCompletedAt: null,
  activeConfigurations: 0,
  lastErrorCode: null,
  lastErrorMessage: null,
};

async function tick(now = new Date()) {
  state.lastTickStartedAt = now;
  state.lastErrorCode = null;
  state.lastErrorMessage = null;
  try {
    await executionService.recoverStaleRuns(now);
    const rows = await Programacion.findAll({ where: { activo: true }, order: [["id", "ASC"]] });
    state.activeConfigurations = rows.length;
    for (const row of rows) {
      try {
        await executionService.executeScheduled(row, now);
      } catch (error) {
        state.lastErrorCode = error.code || "GHL_WORKFLOW_SCHEDULE_ERROR";
        state.lastErrorMessage = configurationService.sanitize(error.message);
        console.error("[GHL_WORKFLOW] SCHEDULE_ERROR", {
          configuracionId: row.id,
          codigo: state.lastErrorCode,
          mensaje: state.lastErrorMessage,
        });
      }
    }
  } catch (error) {
    state.lastErrorCode = error.code || "GHL_WORKFLOW_SCHEDULER_ERROR";
    state.lastErrorMessage = configurationService.sanitize(error.message);
    throw error;
  } finally {
    state.lastTickCompletedAt = new Date();
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
  state.started = true;
  state.startedAt = new Date();
  console.log("Scheduler de workflows GHL iniciado", { timezone: configurationService.TIME_ZONE });
  return task;
}

function getStatus(now = new Date()) {
  return {
    ...state,
    timezone: configurationService.TIME_ZONE,
    localNow: configurationService.localParts(now),
  };
}

module.exports = { tick, start, getStatus };
