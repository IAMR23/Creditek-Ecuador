const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const LogisticaMastherPhoneCierreDetalle = sequelize.define(
  "LogisticaMastherPhoneCierreDetalle",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    cierreId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "logistica_masther_phone_cierres", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
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
    saldoInicial: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    ingresos: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    salidas: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    ajustes: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    saldoFinal: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  },
  {
    tableName: "logistica_masther_phone_cierre_detalles",
    timestamps: true,
    indexes: [
      {
        name: "logistica_masther_phone_cierre_detalles_cierre_modelo_origen_uk",
        unique: true,
        fields: ["cierreId", "modeloId", "origen"],
      },
    ],
  },
);

module.exports = LogisticaMastherPhoneCierreDetalle;
