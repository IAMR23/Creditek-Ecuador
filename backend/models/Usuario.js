const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");
const Rol = require("./Rol");

const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d).{6,}$/;

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
              "La contraseña debe tener mínimo 6 caracteres e incluir letras y números."
            );
          }
        },
      },
    },

    rolId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "roles",
        key: "id",
      },
    },

    rolPagoId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "roles_pago",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    },

    fechaIngreso: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },

    fechaSalida: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },

    numeroCuenta: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    entidadFinanciera: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    direccion: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    telefono: {
      type: DataTypes.STRING,
      allowNull: true,
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
