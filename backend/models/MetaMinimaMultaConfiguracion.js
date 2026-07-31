const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const MetaMinimaMultaConfiguracion = sequelize.define(
  "MetaMinimaMultaConfiguracion",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    rolPagoId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "roles_pago", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    },
    cargoReferencia: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    minimoUnidades: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: { min: 0 },
    },
    valorMultaUnidad: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      validate: { min: 0 },
    },
    descripcion: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    activo: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    creadoPorId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "usuarios", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    },
    actualizadoPorId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "usuarios", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    },
  },
  {
    tableName: "metas_minimas_multas_configuracion",
    timestamps: true,
    indexes: [
      {
        name: "metas_minimas_multas_rol_pago_unique",
        unique: true,
        fields: ["rolPagoId"],
      },
      {
        name: "metas_minimas_multas_activo_idx",
        fields: ["activo"],
      },
      {
        name: "metas_minimas_multas_cargo_referencia_idx",
        fields: ["cargoReferencia"],
      },
    ],
  },
);

module.exports = MetaMinimaMultaConfiguracion;
