const { DataTypes } = require("sequelize");
const { sequelize } = require("../../config/db");

const PautaMarketing = sequelize.define(
  "PautaMarketing",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    producto: {
      type: DataTypes.STRING(120),
      allowNull: false,
    },
    nombrePagina: {
      type: DataTypes.STRING(160),
      allowNull: false,
    },
    imagen: {
      type: DataTypes.STRING(500),
      allowNull: false,
    },
    seguidoresFacebook: {
      type: DataTypes.BIGINT,
      allowNull: false,
      defaultValue: 0,
    },
    seguidoresInstagram: {
      type: DataTypes.BIGINT,
      allowNull: false,
      defaultValue: 0,
    },
    seguidoresTiktok: {
      type: DataTypes.BIGINT,
      allowNull: false,
      defaultValue: 0,
    },
    tipoContenido: {
      type: DataTypes.STRING(80),
      allowNull: false,
    },
    contenidos: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
    },
    creadoPorId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    actualizadoPorId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    activo: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  },
  {
    tableName: "pautas_marketing",
    timestamps: true,
    indexes: [
      {
        name: "pautas_marketing_activo_producto_idx",
        fields: ["activo", "producto"],
      },
      {
        name: "pautas_marketing_tipo_contenido_idx",
        fields: ["tipoContenido"],
      },
    ],
  },
);

module.exports = PautaMarketing;
