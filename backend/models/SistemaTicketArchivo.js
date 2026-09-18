const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const SistemaTicketArchivo = sequelize.define(
  "SistemaTicketArchivo",
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
    nombreOriginal: { type: DataTypes.STRING(255), allowNull: false },
    nombreAlmacenado: { type: DataTypes.STRING(100), allowNull: false },
    rutaRelativa: { type: DataTypes.STRING(255), allowNull: false },
    mimeType: { type: DataTypes.STRING(120), allowNull: false },
    tamano: { type: DataTypes.INTEGER, allowNull: false },
    esEvidencia: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  },
  {
    tableName: "sistemas_ticket_archivos",
    timestamps: true,
    updatedAt: false,
    indexes: [{ fields: ["ticketId", "createdAt"] }],
  },
);

module.exports = SistemaTicketArchivo;
