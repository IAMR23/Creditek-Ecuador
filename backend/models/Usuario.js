const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;

const Usuario = sequelize.define(
  "Usuario",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    cedula: {
      type: DataTypes.STRING,
    },

    nombre: {
      type: DataTypes.STRING,
    },

    email: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: false,
      validate: {
        isEmail: true,
      },
    },

    password: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        isValidPassword(value) {
          if (!passwordRegex.test(value)) {
            throw new Error(
              "La contraseña debe tener mínimo 8 caracteres, incluyendo mayúsculas, minúsculas, números y un carácter especial."
            );
          }
        },
      },
    },

    rol: {
      type: DataTypes.ENUM("admin", "vendedor", "repartidor" , "logistica" ),
      defaultValue: "vendedor",
    },

    activo: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
  },
  {
    timestamps: true,
    tableName: "usuarios",
  }
);

module.exports = Usuario;
