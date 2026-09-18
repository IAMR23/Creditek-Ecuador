const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const SistemaTicketHistorial = sequelize.define(
  "SistemaTicketHistorial",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    ticketId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "sistemas_tickets", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    },
    usuarioId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "usuarios", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    },
    accion: { type: DataTypes.STRING(50), allowNull: false },
    cambios: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
  },
  {
    tableName: "sistemas_ticket_historial",
    timestamps: true,
    updatedAt: false,
    indexes: [{ fields: ["ticketId", "createdAt"] }],
  },
);

module.exports = SistemaTicketHistorial;
