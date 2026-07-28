const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const NotificacionPersonalLectura = sequelize.define(
  "NotificacionPersonalLectura",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    notificacionId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "notificaciones_personal",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },
    usuarioId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "usuarios",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },
    leidaAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: "notificaciones_personal_lecturas",
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ["notificacionId", "usuarioId"],
      },
      { fields: ["usuarioId", "leidaAt"] },
    ],
  },
);

module.exports = NotificacionPersonalLectura;
