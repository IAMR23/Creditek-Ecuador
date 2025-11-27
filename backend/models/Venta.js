const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");
const UsuarioAgencia = require("./UsuarioAgencia");
const Producto = require("./Producto");

const Venta = sequelize.define(
  "Venta",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    usuarioAgenciaId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    productoId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    entrada: DataTypes.STRING,
    alcance: DataTypes.STRING,
    origen: DataTypes.STRING,
    obsequios: DataTypes.STRING,
    activo: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  },
  {
    tableName: "ventas",
    timestamps: true,
  }
);

// =========================
// 🚀 AQUI FALTABA ESTO
// =========================
Venta.belongsTo(UsuarioAgencia, {
  foreignKey: "usuarioAgenciaId",
  as: "usuarioAgencia",
});

Venta.belongsTo(Producto, {
  foreignKey: "productoId",
  as: "producto",
});

module.exports = Venta;
