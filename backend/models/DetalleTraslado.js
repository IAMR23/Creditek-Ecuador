// models/DetalleTraslado.js
const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");
const Venta = require("./Venta");
const DispositivoMarca = require("./DispositivoMarca"); // Cambiado a DispositivoMarca
const Modelo = require("./Modelo");
const Traslado = require("./Traslado");

const DetalleTraslado = sequelize.define(
  "DetalleTraslado",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    cantidad: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: { min: 1 },
    },

    dispositivoMarcaId: {
      // Cambio importante
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: DispositivoMarca, key: "id" },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    },

    modeloId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: Modelo, key: "id" },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    },
    trasladoId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: Traslado,
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    },
  },
  {
    tableName: "detalle_traslados",
    timestamps: true,
  },
);

module.exports = DetalleTraslado;
