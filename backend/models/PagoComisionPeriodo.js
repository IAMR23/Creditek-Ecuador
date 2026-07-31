const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const PagoComisionPeriodo = sequelize.define(
  "PagoComisionPeriodo",
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
    estado: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "PAGADO",
    },
    reporteSnapshot: {
      type: DataTypes.JSONB,
      allowNull: false,
      field: "reporte_snapshot",
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
    pagadoPorId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "pagado_por_id",
      references: { model: "usuarios", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    },
    pagadoAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "pagado_at",
    },
  },
  {
    tableName: "pagos_comisiones_periodos",
    timestamps: true,
    indexes: [
      {
        name: "pagos_comisiones_periodos_anio_mes_unique",
        unique: true,
        fields: ["anio", "mes"],
      },
      {
        name: "pagos_comisiones_periodos_estado_idx",
        fields: ["estado"],
      },
    ],
  },
);

module.exports = PagoComisionPeriodo;
