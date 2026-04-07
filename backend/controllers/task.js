const { Op } = require("sequelize");
const Task = require("../models/Task");
const Usuario = require("../models/Usuario");

exports.createTask = async (req, res) => {
  try {
    const data = req.body;
    const usuarioId = req.user?.id;

    if (!usuarioId) {
      return res.status(400).json({
        ok: false,
        message: "Usuario no identificado",
      });
    }

    const task = await Task.create({
      ...data,
      assignedTo: parseInt(data.assignedTo),
      createdBy: usuarioId,
      reminderTime: data.reminderTime || null,
    });

    const fullTask = await Task.findByPk(task.id, {
      include: [
        {
          model: Usuario,
          as: "creator",
          attributes: ["id", "nombre", "email"],
        },
        {
          model: Usuario,
          as: "assignee",
          attributes: ["id", "nombre", "email"],
        },
      ],
    });

    const io = req.app.get("io");

    io.to(`user_${task.assignedTo}`).emit("task:sync", {
      type: "created",
      task: fullTask,
    });

    res.status(201).json(fullTask);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al crear la tarea" });
  }
};

exports.getMyTasks = async (req, res) => {
  try {
    const usuarioId = req.user?.id;

    if (!usuarioId) {
      return res.status(400).json({
        ok: false,
        message: "Usuario no identificado",
      });
    }
 
    const tasks = await Task.findAll({
      where: {
        assignedTo: usuarioId,
        status: { [Op.ne]: "completada" }
      },
        include: [
        {
          model: Usuario,
          as: "creator",
          attributes: ["id", "nombre", "email"]
        },
        {
          model: Usuario,
          as: "assignee",
          attributes: ["id", "nombre", "email"]
        }
      ],
      order: [["createdAt", "DESC"]],
    });

    return res.status(200).json({
      ok: true,
      data: tasks,
    });
 
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      ok: false,
      message: "Error al obtener las tareas",
    });
  }
};


exports.getTasks = async (req, res) => {
  try {
    const usuarioId = req.user?.id;

    if (!usuarioId) {
      return res.status(400).json({
        ok: false,
        message: "Usuario no identificado",
      });
    }

    const {
      status,
      fechaInicio,
      fechaFin,
      priority
    } = req.query;

    const where = {
      [Op.or]: [
        { createdBy: usuarioId },
        { assignedTo: usuarioId }
      ]
    };

    if (status) where.status = status;
    if (priority) where.priority = priority;

    if (fechaInicio && fechaFin) {
      where.dueDate = {
        [Op.between]: [new Date(fechaInicio), new Date(fechaFin)]
      };
    }

    const tasks = await Task.findAll({
      where,
      order: [["createdAt", "DESC"]],
      include: [
        {
          model: Usuario,
          as: "creator",
          attributes: ["id", "nombre", "email"]
        },
        {
          model: Usuario,
          as: "assignee",
          attributes: ["id", "nombre", "email"]
        }
      ]
    });

    res.json(tasks);

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al obtener tareas" });
  }
};


// ✅ Obtener una tarea por ID
exports.getTaskById = async (req, res) => {
  try {
    const { id } = req.params;

    const task = await Task.findByPk(id);

    if (!task) {
      return res.status(404).json({ message: "Tarea no encontrada" });
    }

    res.json(task);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al obtener la tarea" });
  }
};


// ✅ Actualizar tarea
exports.updateTask = async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;

    const task = await Task.findByPk(id);

    if (!task) {
      return res.status(404).json({ message: "Tarea no encontrada" });
    }

    await task.update(data);

    res.json(task);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al actualizar la tarea" });
  }
};


// ✅ Eliminar (soft delete por paranoid)
exports.deleteTask = async (req, res) => {
  try {
    const { id } = req.params;

    const task = await Task.findByPk(id);

    if (!task) {
      return res.status(404).json({ message: "Tarea no encontrada" });
    }

    await task.destroy();

    res.json({ message: "Tarea eliminada correctamente" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al eliminar la tarea" });
  }
};


exports.completeTask = async (req, res) => {
  try {
    const { id } = req.params;

    const task = await Task.findByPk(id);

    if (!task) {
      return res.status(404).json({ message: "Tarea no encontrada" });
    }

    await task.update({
      status: "completada",
    });

    const updatedTask = await Task.findByPk(id, {
      include: [
        {
          model: Usuario,
          as: "creator",
          attributes: ["id", "nombre", "email"],
        },
        {
          model: Usuario,
          as: "assignee",
          attributes: ["id", "nombre", "email"],
        },
      ],
    });

    const io = req.app.get("io");

    io.to(`user_${task.assignedTo}`).emit("task:sync", {
      type: "completed",
      task: updatedTask,
    });

    res.json({
      message: "Tarea completada",
      task: updatedTask,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al completar tarea" });
  }
};


// ✅ Obtener tareas pendientes con recordatorio activo
exports.getTasksWithReminder = async (req, res) => {
  try {
    const now = new Date();

    const tasks = await Task.findAll({
      where: {
        status: { [Op.ne]: "completada" },
        reminderAt: { [Op.ne]: null }
      }
    });

    res.json(tasks);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al obtener recordatorios" });
  }
};


// ✅ Marcar tarea como notificada (guarda la fecha del último recordatorio enviado)
exports.notifyTask = async (req, res) => {
  try {
    const { id } = req.params;

    const task = await Task.findByPk(id);

    if (!task) {
      return res.status(404).json({ message: "Tarea no encontrada" });
    }

    await task.update({
      lastReminderSent: new Date()
    });

    res.json({ ok: true, message: "Notificación registrada", task });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al registrar notificación" });
  }
};
