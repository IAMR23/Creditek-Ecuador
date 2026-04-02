const { Op } = require("sequelize");
const Task = require("../models/Task");


exports.createTask = async (req, res) => {
  try {
    const data = req.body;

    const usuarioAgenciaId = req.user?.usuarioAgenciaId;

    if (!usuarioAgenciaId) {
      return res.status(400).json({
        ok: false,
        message: "Usuario no identificado",
      });
    }

    const task = await Task.create({
      ...data,
      assignedTo: parseInt(data.assignedTo),
      createdBy: usuarioAgenciaId,

      // 🔥 FIX CLAVE
      reminderTime: data.reminderTime || null
    });

    res.status(201).json(task);

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al crear la tarea" });
  }
};


exports.getMyTasks = async (req, res) => {
  try {
    const usuarioAgenciaId = req.user?.usuarioAgenciaId;

    if (!usuarioAgenciaId) {
      return res.status(400).json({
        ok: false,
        message: "Usuario no identificado",
      });
    }

    const tasks = await Task.findAll({
      where: {
        assignedTo: usuarioAgenciaId,
      },
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


// ✅ Obtener todas las tareas (con filtros)
exports.getTasks = async (req, res) => {
  try {
    const {
      status,
      assignedTo,
      createdBy,
      fechaInicio,
      fechaFin,
      priority
    } = req.query;

    const where = {};

    if (status) where.status = status;
    if (assignedTo) where.assignedTo = assignedTo;
    if (createdBy) where.createdBy = createdBy;
    if (priority) where.priority = priority;

    // 📅 Filtro por fechas (dueDate)
    if (fechaInicio && fechaFin) {
      where.dueDate = {
        [Op.between]: [new Date(fechaInicio), new Date(fechaFin)]
      };
    }

    const tasks = await Task.findAll({
      where,
      order: [["createdAt", "DESC"]]
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


// ✅ Marcar como completada
exports.completeTask = async (req, res) => {
  try {
    const { id } = req.params;

    const task = await Task.findByPk(id);

    if (!task) {
      return res.status(404).json({ message: "Tarea no encontrada" });
    }

    await task.update({
      status: "completada"
    });

    res.json({ message: "Tarea completada", task });
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
