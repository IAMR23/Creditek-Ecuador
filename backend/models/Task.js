const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const Task = sequelize.define("Task", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true
  },

  title: {
    type: DataTypes.STRING,
    allowNull: false
  },

  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },

  status: {
    type: DataTypes.ENUM("pendiente", "en_progreso", "completada"),
    defaultValue: "pendiente"
  },

  // Usuario que crea la tarea
  createdBy: {
    type: DataTypes.INTEGER,
    allowNull: false
  },

  // Usuario asignado
  assignedTo: {
    type: DataTypes.INTEGER,
    allowNull: false
  },

  dueDate: {
    type: DataTypes.DATE,
    allowNull: true
  },

  reminderAt: {
    type: DataTypes.DATE,
    allowNull: true
  },

  // Para evitar duplicar notificaciones
  notified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  }, 

  priority: {
  type: DataTypes.ENUM("baja", "media", "alta"),
  defaultValue: "media"
}


}, {
  tableName: "tasks",
  timestamps: true,
  paranoid: true, // soft delete (deletedAt)
  indexes: [
    { fields: ["assignedTo"] },
    { fields: ["reminderAt"] }
  ]
});

module.exports = Task;