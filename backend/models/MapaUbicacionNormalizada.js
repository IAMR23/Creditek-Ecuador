const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const MapaUbicacionNormalizada = sequelize.define(
  "MapaUbicacionNormalizada",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    entidadTipo: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    entidadId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    ubicacionOriginal: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    tipoUbicacion: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    latitud: {
      type: DataTypes.DECIMAL(10, 7),
      allowNull: true,
    },
    longitud: {
      type: DataTypes.DECIMAL(10, 7),
      allowNull: true,
    },
    estadoGeocodificacion: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "pendiente",
    },
    precision: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    procesadoEn: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    errorDetalle: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    zonaId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  },
  {
    tableName: "mapa_ubicaciones_normalizadas",
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ["entidadTipo", "entidadId"],
      },
      {
        fields: ["estadoGeocodificacion"],
      },
    ],
  },
);

module.exports = MapaUbicacionNormalizada;
