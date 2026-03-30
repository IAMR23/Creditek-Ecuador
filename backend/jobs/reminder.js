const cron = require("node-cron");
const { Op } = require("sequelize");
const Task = require("../models/Task");
const { enviarNotificacion } = require("../services/notificacion");
const UsuarioAgencia = require("../models/UsuarioAgencia");

cron.schedule("* * * * *", async () => {
  const now = new Date();

  const tasks = await Task.findAll({
    where: {
      reminderAt: { [Op.lte]: now },
      notified: false
    },
    include: [{ model: UsuarioAgencia, as: "assignee" }]
  });

  for (const task of tasks) {
    if (task.assignee?.fcmToken) {
      await enviarNotificacion(
        task.assignee.fcmToken,
        "Recordatorio de tarea",
        task.title
      );
    }

    task.notified = true;
    await task.save();
  }
});