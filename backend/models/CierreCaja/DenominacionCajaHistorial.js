const { DataTypes } = require("sequelize");
const { sequelize } = require("../../config/db");

const DenominacionCajaHistorial = sequelize.define(
  "DenominacionCajaHistorial",
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
    cierreId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "cierre_caja",
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
    total: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
    },
    accion: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    creadoPorUsuarioId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "usuarios",
        key: "id",
      },
    },
    fechaSnapshot: {
      type: DataTypes.DATE,
      allowNull: false,
    },
  },
  {
    tableName: "denominaciones_caja_historial",
    freezeTableName: true,
    timestamps: true,
  },
);

module.exports = DenominacionCajaHistorial;
