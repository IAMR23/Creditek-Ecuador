const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const ConfiguracionMesComision = sequelize.define(
  "ConfiguracionMesComision",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    anio: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: { min: 1900, max: 2500 },
    },
    mes: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: { min: 1, max: 12 },
    },
    cantidadSemanas: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "cantidad_semanas",
      validate: { isIn: [[4, 5]] },
    },
    observacion: {
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
      field: "creado_por_id",
      references: { model: "usuarios", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    },
    actualizadoPorId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "actualizado_por_id",
      references: { model: "usuarios", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    },
  },
  {
    tableName: "configuraciones_meses_comisiones",
    timestamps: true,
    indexes: [
      {
        name: "configuraciones_meses_comisiones_anio_mes_unique",
        unique: true,
        fields: ["anio", "mes"],
      },
      {
        name: "configuraciones_meses_comisiones_activo_idx",
        fields: ["activo"],
      },
    ],
  },
);

module.exports = ConfiguracionMesComision;
