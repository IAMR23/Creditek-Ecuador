const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const GhlAsesorVinculo = sequelize.define(
  "GhlAsesorVinculo",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    usuarioId: { type: DataTypes.INTEGER, allowNull: false, unique: true },
    ghlUserId: { type: DataTypes.STRING(100), allowNull: false, unique: true },
    ghlNombre: { type: DataTypes.STRING(200), allowNull: false },
    ghlEmail: { type: DataTypes.STRING(200), allowNull: true },
    activo: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    estadoRecepcion: {
      type: DataTypes.STRING(10),
      allowNull: false,
      defaultValue: "PAUSADO",
      validate: { isIn: [["ACTIVO", "PAUSADO"]] },
    },
    estadoFechaLocal: { type: DataTypes.DATEONLY, allowNull: true },
    estadoCambiadoAt: { type: DataTypes.DATE, allowNull: true },
    estadoCambiadoPorId: { type: DataTypes.INTEGER, allowNull: true },
    motivoUltimoCambio: {
      type: DataTypes.STRING(20),
      allowNull: true,
      validate: { isIn: [["asesor", "administrador"]] },
    },
  },
  {
    tableName: "ghl_asesor_vinculos",
    timestamps: true,
    indexes: [
      { fields: ["activo", "estadoRecepcion", "estadoFechaLocal"] },
    ],
  },
);

module.exports = GhlAsesorVinculo;
