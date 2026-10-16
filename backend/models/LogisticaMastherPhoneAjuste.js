const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const LogisticaMastherPhoneAjuste = sequelize.define(
  "LogisticaMastherPhoneAjuste",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    modeloId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "modelos", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    },
    origen: {
      type: DataTypes.STRING(20),
      allowNull: false,
      validate: { isIn: [["CREDITEK", "PROVEEDOR"]] },
    },
    cantidad: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: { isInt: true, notIn: [[0]] },
    },
    motivo: {
      type: DataTypes.STRING(500),
      allowNull: false,
    },
    tipo: {
      type: DataTypes.STRING(30),
      allowNull: false,
      defaultValue: "AJUSTE",
      validate: { isIn: [["AJUSTE", "CORRECCION_CIERRE"]] },
    },
    cierreCorregidoId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "logistica_masther_phone_cierres", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    },
    fechaAjuste: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    registradoPorId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "usuarios", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    },
    requestKey: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
  },
  {
    tableName: "logistica_masther_phone_ajustes",
    timestamps: true,
    updatedAt: false,
    indexes: [
      {
        name: "logistica_masther_phone_ajustes_request_key_uk",
        unique: true,
        fields: ["requestKey"],
      },
      {
        name: "logistica_masther_phone_ajustes_modelo_fecha_idx",
        fields: ["modeloId", "fechaAjuste"],
      },
    ],
  },
);

module.exports = LogisticaMastherPhoneAjuste;
