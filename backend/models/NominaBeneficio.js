const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const TIPOS_BENEFICIO_NOMINA = [
  "IESS",
  "DECIMO_TERCERO",
  "DECIMO_CUARTO",
  "FONDOS_RESERVA",
  "UTILIDADES",
  "FINIQUITO",
  "FACTURA",
];

const NominaBeneficio = sequelize.define(
  "NominaBeneficio",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    nominaEmpleadoId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "nomina_empleados",
        key: "id",
      },
      onDelete: "CASCADE",
    },
    tipoBeneficio: {
      type: DataTypes.ENUM(...TIPOS_BENEFICIO_NOMINA),
      allowNull: false,
    },
    activo: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    observacion: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    timestamps: true,
    tableName: "nomina_beneficios",
    indexes: [
      {
        unique: true,
        fields: ["nominaEmpleadoId", "tipoBeneficio"],
      },
    ],
  },
);

module.exports = { NominaBeneficio, TIPOS_BENEFICIO_NOMINA };
