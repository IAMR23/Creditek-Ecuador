const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const FormaPago = sequelize.define(
  "FormaPago",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    nombre: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      comment: "Nombre de la forma de pago, por ejemplo Efectivo, Tarjeta, Transferencia",
    },
    descripcion: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    activo: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  },
  {
    tableName: "formas_pago",
    timestamps: true, // createdAt y updatedAt
  }
);

module.exports = FormaPago;
