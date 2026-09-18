const fs = require("fs");
const path = require("path");
require("dotenv").config();
const { sequelize } = require("../config/db");

async function run() {
  const migrationPath = path.join(
    __dirname,
    "../migrations/202609180003-create-sistemas-capacitacion-videos.sql",
  );
  const sql = fs.readFileSync(migrationPath, "utf8");
  await sequelize.authenticate();
  await sequelize.query(sql);

  const [tables] = await sequelize.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'sistemas_capacitacion_videos'
  `);
  if (tables.length !== 1) {
    throw new Error("La migración no creó la tabla de videos de capacitación");
  }
  console.log("Migración de videos de capacitación aplicada correctamente.");
}

run()
  .catch((error) => {
    console.error("No se pudo aplicar la migración de capacitación", {
      code: error.original?.code || error.code || "CAPACITACION_MIGRATION_ERROR",
      message: String(error.message || "Error de migración").slice(0, 300),
    });
    process.exitCode = 1;
  })
  .finally(async () => sequelize.close().catch(() => {}));
