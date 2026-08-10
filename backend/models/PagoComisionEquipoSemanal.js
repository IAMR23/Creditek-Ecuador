const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const PagoComisionEquipoSemanal = sequelize.define(
  "PagoComisionEquipoSemanal",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    jefeComercialId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "usuarios", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    },
    semanaInicio: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    vendedorIds: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
    },
    actualizadoPorId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "usuarios", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    },
  },
  {
    tableName: "pagos_comisiones_equipos_semanales",
    timestamps: true,
    indexes: [
      {
        name: "pagos_comisiones_equipos_jefe_semana_unique",
        unique: true,
        fields: ["jefeComercialId", "semanaInicio"],
      },
      {
        name: "pagos_comisiones_equipos_semana_idx",
        fields: ["semanaInicio"],
      },
    ],
  },
);

module.exports = PagoComisionEquipoSemanal;
