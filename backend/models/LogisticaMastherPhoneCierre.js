const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const LogisticaMastherPhoneCierre = sequelize.define(
  "LogisticaMastherPhoneCierre",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    periodoInicio: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    periodoFinExclusivo: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    cerradoPorId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "usuarios", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    },
    cerradoEn: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "logistica_masther_phone_cierres",
    timestamps: true,
    indexes: [
      {
        name: "logistica_masther_phone_cierres_periodo_uk",
        unique: true,
        fields: ["periodoInicio"],
      },
    ],
  },
);

module.exports = LogisticaMastherPhoneCierre;
