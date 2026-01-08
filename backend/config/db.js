// db.js
const { Sequelize } = require("sequelize");

// Configuración de conexión
const DB_NAME = process.env.DB_NAME || "CREDITEK";
const DB_USER = process.env.DB_USER || "postgres"; 
const DB_PASS = process.env.DB_PASS || "Creditk2025@.";
const DB_HOST = process.env.DB_HOST || "localhost";
const DB_PORT = process.env.DB_PORT || 5432;

// Inicializar Sequelize
const sequelize = new Sequelize(DB_NAME, DB_USER, DB_PASS, {
  host: DB_HOST,
  port: DB_PORT,
  dialect: "postgres",
  logging: false, // desactivar logs SQL en consola
  timezone: "-05:00",
  dialectOptions: {
    useUTC: false,
  },
});

// Función para conectar y sincronizar modelos
const connectDB = async () => {
  try {
    await sequelize.authenticate();
    console.log("✅ Conectado a PostgreSQL exitosamente");

    // Sincronizar todos los modelos y crear tablas faltantes
    await sequelize.sync({ 
      /* force : true */
      /*  force: false  */
    }); // alter: true actualiza tablas sin borrarlas
    console.log("✅ Tablas sincronizadas correctamente");  
  } catch (error) {
    console.error("❌ Error de conexión o sincronización:", error);
    process.exit(1);
  }
};

module.exports = { sequelize, connectDB };
