const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const SistemaTicketComentario = sequelize.define(
  "SistemaTicketComentario",
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
    contenido: { type: DataTypes.TEXT, allowNull: false },
    esEvidenciaPruebas: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
  },
  {
    tableName: "sistemas_ticket_comentarios",
    timestamps: true,
    updatedAt: false,
    indexes: [{ fields: ["ticketId", "createdAt"] }],
  },
);

module.exports = SistemaTicketComentario;
