const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");
const Usuario = require("./Usuario");

const ConsejoEjecutivoSala = sequelize.define(
  "ConsejoEjecutivoSala",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    nombre: {
      type: DataTypes.STRING(120),
      allowNull: false,
    },
    descripcion: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    creadoPorId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: Usuario,
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    },
    activo: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  },
  {
    tableName: "consejo_ejecutivo_salas",
    timestamps: true,
    indexes: [
      { fields: ["creadoPorId"] },
      { fields: ["activo"] },
    ],
  },
);

module.exports = ConsejoEjecutivoSala;
