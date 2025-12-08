const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const Obsequio = sequelize.define(
  "Obsequio",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    nombre: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    costoReferencial: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0,
    },

    activo: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  },
  {
    timestamps: true,
    tableName: "obsequios",
  }
);

module.exports = Obsequio;
