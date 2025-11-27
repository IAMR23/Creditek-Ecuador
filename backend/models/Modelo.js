const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");
const Marca = require("./Marca");

const Modelo = sequelize.define(
  "Modelo",
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
    activo: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  },
  {
    timestamps: true,
    tableName: "modelos",
  }
);

// Relación: un modelo pertenece a una marca
Modelo.belongsTo(Marca, { foreignKey: "marcaId" });
Marca.hasMany(Modelo, { foreignKey: "marcaId" });

module.exports = Modelo;
