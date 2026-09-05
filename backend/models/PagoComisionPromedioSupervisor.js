const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const PagoComisionPromedioSupervisor = sequelize.define(
  "PagoComisionPromedioSupervisor",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    supervisorComercialId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "usuarios", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    },
    anio: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    mes: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    vendedorIds: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
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
    tableName: "pagos_comisiones_promedios_supervisores",
    timestamps: true,
    indexes: [
      {
        name: "pagos_comisiones_promedios_supervisor_mes_unique",
        unique: true,
        fields: ["supervisorComercialId", "anio", "mes"],
      },
      {
        name: "pagos_comisiones_promedios_periodo_idx",
        fields: ["anio", "mes"],
      },
    ],
  },
);

module.exports = PagoComisionPromedioSupervisor;
