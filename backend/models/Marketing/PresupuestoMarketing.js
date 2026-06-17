const { DataTypes } = require("sequelize");
const { sequelize } = require("../../config/db");

const PresupuestoMarketing = sequelize.define(
  "PresupuestoMarketing",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    departamentoId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "agencias",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    },
    fechaInicio: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    fechaFin: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    mes: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    anio: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    presupuestoAsignado: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
    },
    metaVentas: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    descripcion: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    activo: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  },
  {
    tableName: "presupuesto_marketing",
    timestamps: true,
  },
);

module.exports = PresupuestoMarketing;
