const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const RolPago = sequelize.define(
  "RolPago",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    nivel: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    cargo: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    descripcion: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    sueldoBase: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
    },
    sueldoExtra: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
    },
    comisiones: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    ingresoMin: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
    ingresoMax: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
    activo: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  },
  {
    tableName: "roles_pago",
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ["cargo"],
      },
      {
        fields: ["nivel"],
      },
      {
        fields: ["activo"],
      },
    ],
  },
);

module.exports = RolPago;
