require("dotenv").config();

const fs = require("fs");
const path = require("path");
const { sequelize } = require("../config/db");

async function run() {
  await sequelize.authenticate();
  const migrations = [
    "202609280002-create-ghl-difusion-listas.sql",
    "202609280003-create-ghl-difusion-ejecuciones.sql",
    "202609290001-create-ghl-difusion-mensajes-y-variantes.sql",
    "202610020001-add-ghl-difusion-scheduled-at.sql",
  ];
  for (const migration of migrations) {
    const sql = fs.readFileSync(path.join(__dirname, "../migrations", migration), "utf8");
    await sequelize.query(sql);
  }
  console.log("Migraciones de difusiones GHL aplicadas");
}

run()
  .catch((error) => {
    console.error("No se pudieron aplicar las migraciones de difusiones GHL", {
      code: error.code,
      message: error.message,
    });
    process.exitCode = 1;
  })
  .finally(async () => sequelize.close().catch(() => {}));
