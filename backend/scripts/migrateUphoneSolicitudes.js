require("dotenv").config();

const fs = require("fs");
const path = require("path");
const { sequelize } = require("../config/db");

async function run() {
  await sequelize.authenticate();
  const migrations = [
    "202609280004-create-uphone-solicitudes.sql",
    "202609280005-allow-uphone-api-key-imports.sql",
    "202609290002-add-uphone-cedula-unique.sql",
    "202609300001-uphone-cedula-unique-por-dia.sql",
  ];
  for (const migration of migrations) {
    const sql = fs.readFileSync(path.join(__dirname, "../migrations", migration), "utf8");
    await sequelize.query(sql);
  }
  console.log("Migraciones de solicitudes Uphone aplicadas");
}

run()
  .catch((error) => {
    console.error("No se pudieron aplicar las migraciones de solicitudes Uphone", {
      code: error.code,
      message: error.message,
    });
    process.exitCode = 1;
  })
  .finally(async () => sequelize.close().catch(() => {}));
