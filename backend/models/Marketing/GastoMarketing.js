const { DataTypes } = require("sequelize");
const { sequelize } = require("../../config/db");

const GastoMarketing = sequelize.define(
  "GastoMarketing",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    departamentoId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "agencias",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    },
    fecha: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    categoria: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    descripcion: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    monto: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
    },
    tipoModulo: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "MARKETING",
    },
  },
  {
    tableName: "gastos_marketing",
    timestamps: true,
  },
);

module.exports = GastoMarketing;
