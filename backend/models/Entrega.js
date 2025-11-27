const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");
const Cliente = require("./Cliente");
const Producto = require("./Producto");
const UsuarioAgencia = require("./UsuarioAgencia");

const Entrega = sequelize.define(
  "Entrega",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    contrato: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    origen: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    valor_entrada: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0,
    },

    valor_alcance: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0,
    },

    ubicacion: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    ubicacion_dispositivo: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    obsequios: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    observacion: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    estado: {
      type: DataTypes.ENUM("realizado", "pendiente" , "aprobado" ,  "rechazado"),
      defaultValue: "pendiente",
    },
  },
  {
    timestamps: true,
    tableName: "entregas",
  }
);

// 🔗 Relaciones
Entrega.belongsTo(Cliente, { foreignKey: "clienteId", as: "cliente" });
Cliente.hasMany(Entrega, { foreignKey: "clienteId", as: "entregas" });

Entrega.belongsTo(Producto, { foreignKey: "productoId", as: "producto" });
Producto.hasMany(Entrega, { foreignKey: "productoId", as: "entregas" });

// 🔗 Relación con UsuarioAgencia (quien gestionó la entrega)
Entrega.belongsTo(UsuarioAgencia, {
  foreignKey: "usuarioAgenciaId",
  as: "usuario_agencia",
});
UsuarioAgencia.hasMany(Entrega, {
  foreignKey: "usuarioAgenciaId",
  as: "entregas",
});

module.exports = Entrega;
