const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const FacebookComentario = sequelize.define(
  "FacebookComentario",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    pageId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    postId: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    commentId: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    parentId: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    autorId: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    autorNombre: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    mensaje: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    rawPayload: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
    },
    estado: {
      type: DataTypes.ENUM("PENDIENTE", "RESPONDIDO", "ERROR", "IGNORADO"),
      allowNull: false,
      defaultValue: "PENDIENTE",
    },
    respuestaGenerada: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    respuestaEnviada: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    errorMensaje: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    tableName: "facebook_comentarios",
    timestamps: true,
    indexes: [
      { unique: true, fields: ["commentId"] },
      { fields: ["pageId"] },
      { fields: ["postId"] },
      { fields: ["estado"] },
    ],
  },
);

module.exports = FacebookComentario;
