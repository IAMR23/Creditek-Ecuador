require("dotenv").config();

const fs = require("fs");
const path = require("path");
const { sequelize } = require("../config/db");

async function run() {
  await sequelize.authenticate();
  const migration = "202609210004-create-ghl-workflow-programaciones.sql";
  const sql = fs.readFileSync(path.join(__dirname, "../migrations", migration), "utf8");
  await sequelize.query(sql);
  console.log("Migracion de programaciones de workflows GHL aplicada");
}

run()
  .catch((error) => {
    console.error("No se pudo aplicar la migracion de workflows GHL", {
      code: error.code,
      message: error.message,
    });
    process.exitCode = 1;
  })
  .finally(async () => sequelize.close().catch(() => {}));
