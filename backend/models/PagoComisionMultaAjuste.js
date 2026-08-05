const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const PagoComisionMultaAjuste = sequelize.define(
  "PagoComisionMultaAjuste",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    usuarioId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "usuarios",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    },
    semanaInicio: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    omitida: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    valorDescontar: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
      validate: {
        min: 0,
      },
    },
    actualizadoPorId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "usuarios",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    },
  },
  {
    tableName: "pagos_comisiones_multas_ajustes",
    timestamps: true,
    indexes: [
      {
        name: "pagos_comisiones_multas_usuario_semana_unique",
        unique: true,
        fields: ["usuarioId", "semanaInicio"],
      },
      {
        name: "pagos_comisiones_multas_semana_idx",
        fields: ["semanaInicio"],
      },
    ],
  },
);

module.exports = PagoComisionMultaAjuste;
