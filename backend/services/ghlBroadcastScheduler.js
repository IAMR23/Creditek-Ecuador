const cron = require("node-cron");
const queueService = require("./ghlBroadcastQueueService");

let task;
let running = false;

async function tick(now = new Date()) {
  if (running) return [];
  running = true;
  try {
    return await queueService.processDueExecutions(now);
  } finally {
    running = false;
  }
}

async function start() {
  if (task) return task;
  await queueService.recoverStaleExecutions();
  task = cron.schedule("* * * * *", () => tick().catch((error) => {
    console.error("[GHL_BROADCAST] SCHEDULER_ERROR", {
      code: error.code || "GHL_BROADCAST_SCHEDULER_ERROR",
      message: error.message,
    });
  }), { timezone: "America/Guayaquil" });
  setImmediate(() => tick().catch(() => {}));
  console.log("Scheduler de difusiones GHL iniciado", { timezone: "America/Guayaquil" });
  return task;
}

function getStatus() {
  return { started: Boolean(task), running };
}

module.exports = { getStatus, start, tick };
