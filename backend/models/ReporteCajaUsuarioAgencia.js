const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const ReporteCajaUsuarioAgencia = sequelize.define(
  "ReporteCajaUsuarioAgencia",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    codigoUsuario: {
      type: DataTypes.STRING(80),
      allowNull: false,
      set(value) {
        this.setDataValue(
          "codigoUsuario",
          String(value || "").trim().toUpperCase(),
        );
      },
    },
    agenciaId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "agencias",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    },
    fechaDesde: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      defaultValue: "2000-01-01",
    },
    fechaHasta: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    activo: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  },
  {
    tableName: "reporte_caja_usuario_agencia",
    timestamps: true,
    indexes: [
      {
        name: "reporte_caja_usuario_agencia_codigo_desde_uidx",
        unique: true,
        fields: ["codigoUsuario", "fechaDesde"],
      },
      {
        name: "reporte_caja_usuario_agencia_activo_agencia_idx",
        fields: ["activo", "agenciaId"],
      },
      {
        name: "reporte_caja_usuario_agencia_codigo_vigencia_idx",
        fields: ["codigoUsuario", "fechaDesde", "fechaHasta"],
      },
    ],
  },
);

module.exports = ReporteCajaUsuarioAgencia;
