const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const ControlFinancieroConciliacionCaja = sequelize.define(
  "ControlFinancieroConciliacionCaja",
  {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true,
    },
    ejecucionId: {
      type: DataTypes.UUID,
      allowNull: false,
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
    fechaReporte: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    fechas: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
    },
    cierreIds: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
    },
    origen: {
      type: DataTypes.STRING(30),
      allowNull: false,
    },
    resultados: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
    },
    resumen: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
    },
    ejecutadoPor: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "usuarios",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    },
  },
  {
    tableName: "control_financiero_conciliaciones_caja",
    timestamps: true,
    indexes: [
      {
        name: "control_financiero_conciliaciones_caja_carga_idx",
        fields: ["cargaId", "createdAt"],
      },
      {
        name: "control_financiero_conciliaciones_caja_ejecucion_unique",
        unique: true,
        fields: ["ejecucionId"],
      },
    ],
    hooks: {
      beforeUpdate() {
        throw new Error(
          "Las conciliaciones historicas de caja no se modifican; debe generarse una nueva ejecucion.",
        );
      },
      beforeBulkUpdate() {
        throw new Error(
          "Las conciliaciones historicas de caja no se modifican; debe generarse una nueva ejecucion.",
        );
      },
      beforeDestroy() {
        throw new Error(
          "Las conciliaciones historicas de caja no se pueden eliminar.",
        );
      },
      beforeBulkDestroy() {
        throw new Error(
          "Las conciliaciones historicas de caja no se pueden eliminar.",
        );
      },
    },
  },
);

module.exports = ControlFinancieroConciliacionCaja;
