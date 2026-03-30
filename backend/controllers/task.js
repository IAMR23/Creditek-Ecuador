const { Op } = require("sequelize");
const UsuarioAgencia = require("../models/UsuarioAgencia");
const Task = require("../models/Task");
const { enviarNotificacion } = require("../services/notificacion");

// ✅ Crear tarea
exports.createTask = async (req, res) => {
  try {
    const { title, description, assignedTo, dueDate, reminderAt } = req.body;

    const task = await Task.create({
      title,
      description,
      createdBy: req.user.id,
      assignedTo,
      dueDate,
      reminderAt
    });

    // Notificar al usuario asignado
    const user = await UsuarioAgencia.findByPk(assignedTo);

    if (user?.fcmToken) {
      await enviarNotificacion(
        user.fcmToken,
        "Nueva tarea asignada",
        title
      );
    }

    res.status(201).json(task);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ✅ Obtener tareas del usuario logueado
exports.getMyTasks = async (req, res) => {
  try {
    const tasks = await Task.findAll({
      where: {
        assignedTo: req.user.id
      },
      include: [
        { model: UsuarioAgencia, as: "creator", attributes: ["id", "name"] }
      ],
      order: [["createdAt", "DESC"]]
    });

    res.json(tasks);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ✅ Filtrar tareas (más flexible)
exports.filterTasks = async (req, res) => {
  try {
    const { status } = req.query;

    const where = {
      assignedTo: req.user.id
    };

    if (status) {
      where.status = status;
    }

    const tasks = await Task.findAll({ where });

    res.json(tasks);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ✅ Cambiar estado
exports.updateTaskStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const task = await Task.findByPk(id);

    if (!task) return res.status(404).json({ msg: "No existe" });

    task.status = status;
    await task.save();

    res.json(task);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};