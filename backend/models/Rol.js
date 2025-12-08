const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const Rol = sequelize.define(
  "Rol",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    nombre: {
      type: DataTypes.STRING(50),
      unique: true,
      allowNull: false,
      validate: {
        notEmpty: {
          msg: "El nombre del rol es obligatorio",
        },
      },
    },

    descripcion: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },

    activo: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  },
  {
    timestamps: true,
    tableName: "roles",
  }
);

module.exports = Rol;
