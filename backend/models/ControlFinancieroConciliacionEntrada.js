const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const ControlFinancieroConciliacionEntrada = sequelize.define(
  "ControlFinancieroConciliacionEntrada",
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
    fecha: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    cierreId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "cierre_caja",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
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
    reglasManuales: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
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
    tableName: "control_financiero_conciliaciones_entradas",
    timestamps: true,
    indexes: [
      {
        name: "control_financiero_conciliaciones_carga_fecha_idx",
        fields: ["cargaId", "fecha", "createdAt"],
      },
      {
        name: "control_financiero_conciliaciones_cierre_idx",
        fields: ["cierreId"],
      },
      {
        name: "control_financiero_conciliaciones_ejecucion_unique",
        unique: true,
        fields: ["ejecucionId"],
      },
    ],
    hooks: {
      beforeUpdate() {
        throw new Error(
          "Las conciliaciones historicas no se modifican; debe generarse una nueva ejecucion.",
        );
      },
      beforeBulkUpdate() {
        throw new Error(
          "Las conciliaciones historicas no se modifican; debe generarse una nueva ejecucion.",
        );
      },
      beforeDestroy() {
        throw new Error("Las conciliaciones historicas no se pueden eliminar.");
      },
      beforeBulkDestroy() {
        throw new Error("Las conciliaciones historicas no se pueden eliminar.");
      },
    },
  },
);

module.exports = ControlFinancieroConciliacionEntrada;
