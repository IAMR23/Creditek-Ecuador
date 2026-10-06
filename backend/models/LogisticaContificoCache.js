const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

module.exports = sequelize.define(
  "LogisticaContificoCache",
  {
    cacheKey: {
      type: DataTypes.STRING(100),
      allowNull: false,
      primaryKey: true,
      validate: { notEmpty: true, len: [1, 100] },
    },
    tipo: {
      type: DataTypes.STRING(30),
      allowNull: false,
      validate: { isIn: [["CATALOGO", "STOCK_PRODUCTO"]] },
    },
    contenido: {
      type: DataTypes.JSONB,
      allowNull: false,
    },
    consultedAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
  },
  {
    tableName: "logistica_contifico_cache",
    timestamps: true,
    indexes: [
      {
        name: "logistica_contifico_cache_tipo_fecha_idx",
        fields: ["tipo", { name: "consultedAt", order: "DESC" }],
      },
    ],
  },
);
