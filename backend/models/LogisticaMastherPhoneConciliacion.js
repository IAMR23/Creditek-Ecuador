const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const LogisticaMastherPhoneConciliacion = sequelize.define(
  "LogisticaMastherPhoneConciliacion",
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
    semanaInicio: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    stockCreditek: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: { isInt: true, min: 0 },
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
    tableName: "logistica_masther_phone_conciliaciones",
    timestamps: true,
    indexes: [
      {
        name: "logistica_masther_phone_conciliaciones_modelo_semana_uk",
        unique: true,
        fields: ["modeloId", "semanaInicio"],
      },
      {
        name: "logistica_masther_phone_conciliaciones_semana_idx",
        fields: ["semanaInicio"],
      },
    ],
  },
);

module.exports = LogisticaMastherPhoneConciliacion;
