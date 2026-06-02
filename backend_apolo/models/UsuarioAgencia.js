const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const UsuarioAgencia = sequelize.define(
  "UsuarioAgencia",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    usuarioId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "usuarios", key: "id" },
      onDelete: "CASCADE",
    },
    agenciaId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "agencias", key: "id" },
      onDelete: "CASCADE",
    },
    activo: { type: DataTypes.BOOLEAN, defaultValue: true },
  },
  {
    timestamps: true,
    tableName: "usuario_agencia",
    indexes: [{ unique: true, fields: ["usuarioId", "agenciaId"] }],
  }
);

module.exports = UsuarioAgencia;

