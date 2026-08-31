const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const TIPOS_DETALLE = ["REPORTE", "CIERRE"];

const ControlFinancieroConciliacionManualCajaDetalle = sequelize.define(
  "ControlFinancieroConciliacionManualCajaDetalle",
  {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true,
    },
    conciliacionManualId: {
      type: DataTypes.BIGINT,
      allowNull: false,
      references: {
        model: "control_financiero_conciliaciones_manual",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    },
    tipo: {
      type: DataTypes.STRING(10),
      allowNull: false,
      validate: {
        isIn: [TIPOS_DETALLE],
      },
    },
    registroReporteId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "control_financiero_registros",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    },
    movimientoCajaId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "movimientos_caja",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    },
    monto: {
      type: DataTypes.DECIMAL(14, 2),
      allowNull: false,
      defaultValue: 0,
    },
    activo: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  },
  {
    tableName: "control_financiero_conciliaciones_manual_detalle",
    timestamps: true,
    indexes: [
      {
        name: "cf_conc_manual_detalle_grupo_idx",
        fields: ["conciliacionManualId", "tipo"],
      },
      {
        name: "cf_conc_manual_detalle_reporte_idx",
        fields: ["registroReporteId"],
      },
      {
        name: "cf_conc_manual_detalle_cierre_idx",
        fields: ["movimientoCajaId"],
      },
    ],
  },
);

ControlFinancieroConciliacionManualCajaDetalle.TIPOS_DETALLE = TIPOS_DETALLE;

module.exports = ControlFinancieroConciliacionManualCajaDetalle;
