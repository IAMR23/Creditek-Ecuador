require("dotenv").config();

const fs = require("fs");
const path = require("path");
const { sequelize } = require("../config/db");

async function run() {
  await sequelize.authenticate();
  const migrations = [
    "202609210001-create-ghl-reparto-tiempo-real-configuracion.sql",
    "202609210002-add-ghl-advisor-auto-pause-time.sql",
  ];
  for (const migration of migrations) {
    const sql = fs.readFileSync(path.join(__dirname, "../migrations", migration), "utf8");
    await sequelize.query(sql);
  }
  console.log("Migracion de configuracion de reparto GHL en tiempo real aplicada");
}

run()
  .catch((error) => {
    console.error("No se pudo aplicar la migracion GHL de tiempo real", {
      code: error.code,
      message: error.message,
    });
    process.exitCode = 1;
  })
  .finally(async () => sequelize.close().catch(() => {}));
