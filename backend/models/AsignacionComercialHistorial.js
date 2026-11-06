const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const AsignacionComercialHistorial = sequelize.define(
  "AsignacionComercialHistorial",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    usuarioId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "usuarios", key: "id" },
    },
    usuarioAgenciaId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "usuario_agencia", key: "id" },
    },
    agenciaId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "agencias", key: "id" },
    },
    equipo: { type: DataTypes.STRING(80), allowNull: true },
    jefeComercialId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "usuarios", key: "id" },
    },
    supervisorComercialId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "usuarios", key: "id" },
    },
    vigenciaDesde: { type: DataTypes.DATEONLY, allowNull: false },
    vigenciaHasta: { type: DataTypes.DATEONLY, allowNull: true },
    requiereRevision: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    fuente: { type: DataTypes.STRING(40), allowNull: false, defaultValue: "MANUAL" },
    observacion: { type: DataTypes.TEXT, allowNull: true },
    registradoPorId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "usuarios", key: "id" },
    },
  },
  {
    tableName: "asignaciones_comerciales_historial",
    timestamps: true,
    validate: {
      rangoValido() {
        if (this.vigenciaHasta && this.vigenciaHasta < this.vigenciaDesde) {
          throw new Error("La fecha final no puede ser anterior a la fecha inicial");
        }
      },
    },
  },
);

module.exports = AsignacionComercialHistorial;
