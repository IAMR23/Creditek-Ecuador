const { DataTypes } = require("sequelize");
const { sequelize } = require("../../config/db");

const CopaCreditekVendedorConfiguracion = sequelize.define(
  "CopaCreditekVendedorConfiguracion",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    usuarioId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "usuarios", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },
    alias: {
      type: DataTypes.STRING(50),
      allowNull: true,
      validate: { len: [1, 50] },
    },
    equipoCopa: {
      type: DataTypes.STRING(40),
      allowNull: true,
      validate: {
        isIn: [["Martha Bucaram", "Caupicho", "Nueva Aurora", "Sangolquí"]],
      },
    },
    mostrarEnMarcador: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  },
  {
    tableName: "copa_creditek_vendedores_configuracion",
    timestamps: true,
    indexes: [
      {
        name: "copa_creditek_vendedores_config_usuario_uidx",
        unique: true,
        fields: ["usuarioId"],
      },
    ],
  },
);

module.exports = CopaCreditekVendedorConfiguracion;
