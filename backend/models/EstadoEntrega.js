// models/EstadoEntrega.js
const { DataTypes } = require('sequelize');
const {sequelize} = require('../config/db'); // Asegúrate de tener tu instancia de Sequelize configurada

const EstadoEntrega = sequelize.define('EstadoEntrega', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  nombre: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
    validate: {
      notEmpty: true,
    },
  },
}, {
  tableName: 'estado_entrega', // Nombre de la tabla en PostgreSQL
  timestamps: true, // Crea createdAt y updatedAt automáticamente
});

module.exports = EstadoEntrega;
