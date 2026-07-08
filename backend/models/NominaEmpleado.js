const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const NominaEmpleado = sequelize.define(
  "NominaEmpleado",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    usuarioId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "usuarios",
        key: "id",
      },
      onDelete: "CASCADE",
    },
    usuarioAgenciaId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "usuario_agencia",
        key: "id",
      },
      onDelete: "CASCADE",
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
    sueldo: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
    },
    cargo: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    estado: {
      type: DataTypes.ENUM("ACTIVO", "PASIVO"),
      allowNull: false,
      defaultValue: "ACTIVO",
    },
    observaciones: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    timestamps: true,
    tableName: "nomina_empleados",
    indexes: [
      {
        unique: true,
        fields: ["usuarioAgenciaId"],
      },
      {
        fields: ["usuarioId"],
      },
      {
        fields: ["estado"],
      },
      {
        fields: ["rolPagoId"],
      },
    ],
  },
);

module.exports = NominaEmpleado;
