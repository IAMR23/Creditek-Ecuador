const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const PagoComisionPromedioJefe = sequelize.define(
  "PagoComisionPromedioJefe",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    jefeComercialId: {
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
    metaVentas: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
      validate: { min: 0.01 },
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
    tableName: "pagos_comisiones_promedios_jefes",
    timestamps: true,
    indexes: [
      {
        name: "pagos_comisiones_promedios_jefes_mes_unique",
        unique: true,
        fields: ["jefeComercialId", "anio", "mes"],
      },
      {
        name: "pagos_comisiones_promedios_jefes_periodo_idx",
        fields: ["anio", "mes"],
      },
    ],
  },
);

module.exports = PagoComisionPromedioJefe;
