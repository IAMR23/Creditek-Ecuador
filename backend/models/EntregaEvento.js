const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const EntregaEvento = sequelize.define(
  "EntregaEvento",
  {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    entregaId: { type: DataTypes.INTEGER, allowNull: false },
    tipo: { type: DataTypes.STRING(40), allowNull: false },
    estadoAnterior: { type: DataTypes.STRING, allowNull: true },
    estadoNuevo: { type: DataTypes.STRING, allowNull: true },
    usuarioAgenciaAnteriorId: { type: DataTypes.INTEGER, allowNull: true },
    usuarioAgenciaNuevoId: { type: DataTypes.INTEGER, allowNull: true },
    actorUsuarioId: { type: DataTypes.INTEGER, allowNull: false },
    motivo: { type: DataTypes.TEXT, allowNull: false },
    idempotencyKey: { type: DataTypes.STRING(160), allowNull: true },
    metadata: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
  },
  {
    tableName: "entrega_eventos",
    timestamps: true,
    updatedAt: false,
    indexes: [
      { fields: ["entregaId", "createdAt"] },
      { unique: true, fields: ["idempotencyKey"] },
    ],
  },
);

module.exports = EntregaEvento;
