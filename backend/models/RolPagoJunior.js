const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const RolPagoJunior = sequelize.define(
  "RolPagoJunior",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    cargoRolPagoId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "roles_pago", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    },
    juniorRolPagoId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "roles_pago", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    },
    activo: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  },
  {
    tableName: "roles_pago_juniors",
    timestamps: true,
    indexes: [
      {
        name: "roles_pago_juniors_cargo_junior_unique",
        unique: true,
        fields: ["cargoRolPagoId", "juniorRolPagoId"],
      },
      { fields: ["activo"] },
    ],
  },
);

module.exports = RolPagoJunior;
