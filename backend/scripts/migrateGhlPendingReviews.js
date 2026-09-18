const fs = require("fs");
const path = require("path");
const { sequelize } = require("../config/db");

async function run() {
  const migrationPath = path.join(
    __dirname,
    "../migrations/202609170001-create-ghl-reparto-revisiones-pendientes.sql",
  );
  const sql = fs.readFileSync(migrationPath, "utf8");

  await sequelize.authenticate();
  await sequelize.transaction(async (transaction) => {
    await sequelize.query(sql, { transaction });
  });
  console.log("Migracion GHL de revisiones pendientes aplicada correctamente");
}

run()
  .catch((error) => {
    console.error("No se pudo aplicar la migracion GHL", {
      code: error.code || "GHL_REVIEW_MIGRATION_ERROR",
      message: String(error.message || "Error de migracion").slice(0, 300),
    });
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close().catch(() => {});
  });
