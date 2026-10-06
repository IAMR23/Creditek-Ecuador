const fs = require("fs");
const path = require("path");
require("dotenv").config();
const { sequelize } = require("../config/db");

async function run() {
  await sequelize.authenticate();
  const sql = fs.readFileSync(
    path.join(
      __dirname,
      "../migrations/202610060004-create-logistica-contifico-cache.sql",
    ),
    "utf8",
  );
  await sequelize.query(sql);
  const [rows] = await sequelize.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'logistica_contifico_cache'
  `);
  if (rows.length !== 1) throw new Error("No se pudo verificar la caché de Contífico.");
  console.log("Migración de caché persistente de Contífico aplicada correctamente.");
}

run()
  .catch((error) => {
    console.error("No se pudo aplicar la migración de caché de Contífico", {
      code: error.original?.code || error.code || "CONTIFICO_CACHE_MIGRATION_ERROR",
    });
    process.exitCode = 1;
  })
  .finally(() => sequelize.close().catch(() => {}));
