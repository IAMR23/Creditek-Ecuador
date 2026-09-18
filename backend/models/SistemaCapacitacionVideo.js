const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const SistemaCapacitacionVideo = sequelize.define(
  "SistemaCapacitacionVideo",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    titulo: {
      type: DataTypes.STRING(180),
      allowNull: false,
    },
    enlace: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    descripcion: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    activo: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    creadoPorId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "usuarios", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    },
    actualizadoPorId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "usuarios", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    },
  },
  {
    tableName: "sistemas_capacitacion_videos",
    timestamps: true,
    indexes: [
      { fields: ["activo", "createdAt"] },
      { fields: ["actualizadoPorId"] },
    ],
  },
);

module.exports = SistemaCapacitacionVideo;
