const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const ComisionConfiguracion = sequelize.define(
  "ComisionConfiguracion",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    grupo: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    subgrupo: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    periodo: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    unidadesVendidas: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    comisionPorEquipo: {
      type: DataTypes.DECIMAL(10, 4),
      allowNull: true,
    },
    porcentaje: {
      type: DataTypes.DECIMAL(10, 4),
      allowNull: true,
    },
    promedioPorVendedor: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    bono: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
    valorAproximado: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    notas: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    orden: {
      type: DataTypes.INTEGER,
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
    tableName: "comisiones_configuracion",
    timestamps: true,
    indexes: [
      {
        name: "comisiones_config_unique",
        unique: true,
        fields: ["grupo", "periodo", "subgrupo", "unidadesVendidas", "orden"],
      },
      {
        name: "comisiones_config_activo_idx",
        fields: ["activo"],
      },
      {
        name: "comisiones_config_grupo_periodo_idx",
        fields: ["grupo", "periodo"],
      },
    ],
  },
);

module.exports = ComisionConfiguracion;
