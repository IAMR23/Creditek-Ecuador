const cron = require("node-cron");
const { Op } = require("sequelize");
const Task = require("../models/Task");

// 🔧 Convierte cualquier Date a hora Ecuador (Date real)
const toEcuadorDate = (date) => {
  return new Date(
    date.toLocaleString("en-US", {
      timeZone: "America/Guayaquil"
    })
  );
};

const processTaskReminder = async (task, now) => {
  // 🔥 Convertimos "now" a hora Ecuador
  const nowEC = toEcuadorDate(now);

  // 🔥 Fecha actual en formato YYYY-MM-DD (Ecuador)
  const fechaEC = nowEC.toISOString().split("T")[0];

  // 🔥 Construimos fecha + hora de la tarea
  const reminderDateTime = new Date(`${fechaEC}T${task.reminderTime}`);

  // 🔥 Diferencia en milisegundos
  const diff = Math.abs(nowEC - reminderDateTime);

  // ⛔ Solo ejecuta si está dentro del minuto
  if (diff > 60000) return;

  // ⛔ Evitar duplicados el mismo día
  if (task.lastReminderSent) {
    const last = toEcuadorDate(new Date(task.lastReminderSent));

    if (last.toDateString() === nowEC.toDateString()) return;
  }

  // ⛔ Si no se repite, solo una vez
  if (task.repeat === "none" && task.lastReminderSent) return;

  // 🔁 Lógica de repetición diaria
  if (task.repeat === "daily") {
    const created = toEcuadorDate(new Date(task.createdAt));

    const daysDiff = Math.floor(
      (nowEC - created) / (1000 * 60 * 60 * 24)
    );

    if (daysDiff % task.repeatInterval !== 0) return;
  }

  // 🔔 NOTIFICACIÓN
  console.log(
    `📢 Recordatorio -> Usuario ${task.assignedTo}: ${task.title}`
  );

  // 📝 Guardar última ejecución
  await task.update({
    lastReminderSent: nowEC
  });
};

const startTaskReminderJob = () => {
  cron.schedule(
    "* * * * *",
    async () => {
      try {
        const now = new Date();

        console.log(
          "⏰ Ejecutando cron (EC):",
          now.toLocaleString("es-EC", {
            timeZone: "America/Guayaquil"
          })
        );

        const tasks = await Task.findAll({
          where: {
            status: { [Op.ne]: "completada" },
            reminderTime: { [Op.ne]: null }
          }
        });

        for (const task of tasks) {
          await processTaskReminder(task, now);
        }
      } catch (error) {
        console.error("❌ Error en cron:", error);
      }
    },
    {
      timezone: "America/Guayaquil" // 🔥 clave
    }
  );
};

module.exports = startTaskReminderJob;