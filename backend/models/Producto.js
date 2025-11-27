const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const Producto = sequelize.define(
  "Producto",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    contifico_id: {
      type: DataTypes.STRING, // porque Contífico usa letras!
      unique: true,
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
    tableName: "productos",
  }
);

module.exports = Producto;
