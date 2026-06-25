const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const MapaComercialZona = sequelize.define(
  "MapaComercialZona",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    agenciaId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    nombre: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    tipo: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "sector",
    },
    latitudCentro: {
      type: DataTypes.DECIMAL(10, 7),
      allowNull: true,
    },
    longitudCentro: {
      type: DataTypes.DECIMAL(10, 7),
      allowNull: true,
    },
    radioMetros: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    poligono: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    activo: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  },
  {
    tableName: "mapa_comercial_zonas",
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ["agenciaId", "nombre"],
      },
    ],
  },
);

module.exports = MapaComercialZona;
