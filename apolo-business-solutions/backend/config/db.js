const { Sequelize } = require("sequelize");

const DB_NAME = process.env.DB_NAME || "APOLO";
const DB_USER = process.env.DB_USER || "postgres";
const DB_PASS = process.env.DB_PASS || "apolo_password";
const DB_HOST = process.env.DB_HOST || "localhost";
const DB_PORT = process.env.DB_PORT || 5432;

const sequelize = new Sequelize(DB_NAME, DB_USER, DB_PASS, {
  host: DB_HOST,
  port: DB_PORT,
  dialect: "postgres",
  logging: false,
  timezone: "-05:00",
  dialectOptions: { useUTC: false },
});

const connectDB = async () => {
  await sequelize.authenticate();
  await sequelize.sync({ alter: true });
};

module.exports = { sequelize, connectDB };
