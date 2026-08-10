const { DataTypes } = require("sequelize");
const { sequelize } = require("../../config/db");

const DenominacionCajaTemp = sequelize.define(
  "DenominacionCajaTemp",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    usuarioAgenciaId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "usuario_agencia",
        key: "id",
      },
    },
    agenciaId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "agencias",
        key: "id",
      },
    },
    usuarioId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "usuarios",
        key: "id",
      },
    },
    valor: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    cantidad: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    estado: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "ACTIVO",
    },
    actualizadoPorUsuarioId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "usuarios",
        key: "id",
      },
    },
    fechaActualizacion: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: "denominaciones_caja_temp",
    freezeTableName: true,
    timestamps: true,
  },
);

module.exports = DenominacionCajaTemp;
