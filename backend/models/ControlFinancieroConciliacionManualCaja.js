const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const ControlFinancieroConciliacionManualCaja = sequelize.define(
  "ControlFinancieroConciliacionManualCaja",
  {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true,
    },
    cargaId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "control_financiero_cargas",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
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
    relacionadoPor: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "usuarios",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    },
    relacionadoEn: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    deshechoPor: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "usuarios",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    },
    deshechoEn: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    motivoDeshacer: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    relacionAnteriorId: {
      type: DataTypes.BIGINT,
      allowNull: true,
    },
  },
  {
    tableName: "control_financiero_conciliaciones_manual",
    timestamps: true,
    indexes: [
      {
        name: "control_financiero_conciliaciones_manual_carga_idx",
        fields: ["cargaId", "activo"],
      },
    ],
  },
);

module.exports = ControlFinancieroConciliacionManualCaja;
