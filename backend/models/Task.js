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

  priority: {
    type: DataTypes.ENUM("baja", "media", "alta"),
    defaultValue: "media"
  }

}, {
  tableName: "tasks",
  timestamps: true,
  paranoid: true,
  indexes: [
    { fields: ["assignedTo"] }
  ]
});

module.exports = Task; 
