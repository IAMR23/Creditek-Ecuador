const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const Task = sequelize.define("Task", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true , 
      autoIncrement: true,
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

  createdBy: {
    type: DataTypes.INTEGER,
    allowNull: false
  },

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

  notified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },

  priority: {
    type: DataTypes.ENUM("baja", "media", "alta"),
    defaultValue: "media"
  },

  // 🔁 Tipo de repetición
  repeat: {
    type: DataTypes.ENUM("none", "daily"),
    defaultValue: "none"
  },

  // 🔁 Intervalo de repetición (en días)
  repeatInterval: {
    type: DataTypes.INTEGER,
    defaultValue: 1
  },

  reminderTime: {
  type: DataTypes.TIME, // "14:30:00"
  allowNull: true
},

  // 🔁 Último recordatorio enviado 
  lastReminderSent: {
    type: DataTypes.DATE,
    allowNull: true
  }

}, {
  tableName: "tasks",
  timestamps: true,
  paranoid: true,
  indexes: [
    { fields: ["assignedTo"] },
    { fields: ["reminderAt"] },
    { fields: ["repeat"] }
  ]
});

module.exports = Task; 