const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");
const Dispositivo = require("./Dispositivo");
const Marca = require("./Marca");

const DispositivoMarca = sequelize.define("DispositivoMarca", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  dispositivoId: {
    type: DataTypes.INTEGER,
    references: { model: Dispositivo, key: "id" },
    allowNull: false,
    field: "dispositivo_id",
  },
  marcaId: {
    type: DataTypes.INTEGER,
    references: { model: Marca, key: "id" },
    allowNull: false,
    field: "marca_id",
  },
  activo: { type: DataTypes.BOOLEAN, defaultValue: true },
});


module.exports = DispositivoMarca;
