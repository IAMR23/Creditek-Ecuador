const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");
const {
  validarRegistro,
  VEHICULOS_COMBUSTIBLE,
} = require("../utils/logisticaCombustible");

const decimal = () => ({
  type: DataTypes.DECIMAL(10, 2),
  allowNull: false,
  validate: { min: 0, max: 99999999.99 },
});

module.exports = sequelize.define(
  "LogisticaCombustibleRegistro",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "usuarios", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    },
    fecha: { type: DataTypes.DATEONLY, allowNull: false },
    // Nullable para conservar registros anteriores sin inventar un vehículo.
    // El servicio exige el vehículo en cada creación y edición.
    vehiculo: {
      type: DataTypes.STRING(20),
      allowNull: true,
      validate: { isIn: [VEHICULOS_COMBUSTIBLE] },
    },
    kilometrajeInicial: decimal(),
    kilometrajeFinal: decimal(),
    kilometrosRecorridos: decimal(),
    // Dato histórico; ya no se solicita ni se calcula en la funcionalidad.
    combustibleConsumido: { ...decimal(), allowNull: true },
    costoCombustible: decimal(),
    observacion: {
      type: DataTypes.STRING(2000),
      allowNull: false,
      defaultValue: "",
    },
  },
  {
    tableName: "logistica_combustible_registros",
    timestamps: true,
    paranoid: true,
    indexes: [
      {
        name: "logistica_combustible_usuario_fecha_idx",
        fields: ["userId", "fecha"],
      },
      { name: "logistica_combustible_fecha_idx", fields: ["fecha"] },
    ],
    hooks: {
      beforeValidate(registro) {
        if (!registro.changed() && !registro.isNewRecord) return;
        const valores = validarRegistro(registro.get({ plain: true }));
        registro.set("kilometrosRecorridos", valores.kilometrosRecorridos);
      },
    },
  },
);
