const cron = require("node-cron");
const { Op } = require("sequelize");
const Task = require("../models/Task");

// 🔧 Ajusta zona horaria (crítico)
function getNow() {
  return new Date(
    new Date().toLocaleString("en-US", {
      timeZone: "America/Guayaquil"
    })
  );
}

// 🔔 Simulación (reemplazar luego por FCM)
async function enviarNotificacion(task) {
  console.log(
    `🔔 [${new Date().toISOString()}] Tarea: ${task.title} → Usuario ${task.assignedTo}`
  );
}

// 🚀 CRON PRINCIPAL (cada minuto)
function startTaskCron() {
  cron.schedule("* * * * *", async () => {
    try {
      const now = getNow();

      const tasks = await Task.findAll({
        where: {
          status: { [Op.ne]: "completada" }
        }
      });

      for (const task of tasks) {

        // =========================
        // 🔹 1. RECORDATORIO ÚNICO
        // =========================
        if (task.repeat === "none") {
          if (!task.reminderAt || task.notified) continue;

          const reminderDate = new Date(task.reminderAt);

          if (now >= reminderDate) {
            await enviarNotificacion(task);

            task.notified = true;
            task.lastReminderSent = now;
            await task.save();
          }

          continue;
        }

        // =========================
        // 🔹 2. RECORDATORIO DIARIO
        // =========================
        if (task.repeat === "daily") {
          if (!task.reminderTime) continue;

          const [hour, minute] = task.reminderTime.split(":");

          const isSameHour = now.getHours() === parseInt(hour);
          const isSameMinute = now.getMinutes() === parseInt(minute);

          if (!isSameHour || !isSameMinute) continue;

          // 🚫 Evitar duplicado el mismo día
          const yaSeEnvioHoy =
            task.lastReminderSent &&
            new Date(task.lastReminderSent).toDateString() === now.toDateString();

          if (yaSeEnvioHoy) continue;

          // 📆 Validar intervalo
          let diasPasados = 999;

          if (task.lastReminderSent) {
            const diffTime = now - new Date(task.lastReminderSent);
            diasPasados = diffTime / (1000 * 60 * 60 * 24);
          }

          if (diasPasados < task.repeatInterval) continue;

          // 🔔 Enviar
          await enviarNotificacion(task);

          task.lastReminderSent = now;
          await task.save();
        }
      }

    } catch (error) {
      console.error("❌ Error en cron de tareas:", error);
    }
  });

  console.log("✅ Cron de tareas iniciado (cada minuto)");
}

module.exports = { startTaskCron };