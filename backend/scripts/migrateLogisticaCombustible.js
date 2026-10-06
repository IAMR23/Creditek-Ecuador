const fs = require("fs");
const path = require("path");
require("dotenv").config();
const { sequelize } = require("../config/db");

async function run() {
  await sequelize.authenticate();
  for (const migration of [
    "202610060001-create-logistica-combustible.sql",
    "202610060002-combustible-vehiculo-sin-consumo.sql",
    "202610060003-combustible-catalogo-vehiculos.sql",
  ]) {
    await sequelize.query(
      fs.readFileSync(path.join(__dirname, "../migrations", migration), "utf8"),
    );
  }
  const [rows] = await sequelize.query(`
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'logistica_combustible_registros'::regclass
      AND conname IN ('logistica_combustible_valores_chk', 'logistica_combustible_vehiculo_catalogo_chk')
  `);
  if (rows.length !== 2)
    throw new Error("No se pudo verificar la restricción de combustible.");
  console.log("Migración de combustible aplicada y verificada.");
}

run()
  .catch((error) => {
    console.error("No se pudo aplicar la migración de combustible", {
      code: error.original?.code || error.code || "COMBUSTIBLE_MIGRATION_ERROR",
    });
    process.exitCode = 1;
  })
  .finally(() => sequelize.close().catch(() => {}));
