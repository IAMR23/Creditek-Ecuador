require("dotenv").config();

const fs = require("fs");
const path = require("path");
const { sequelize } = require("../config/db");

async function run() {
  await sequelize.authenticate();
  const migrations = [
    "202609210001-create-ghl-reparto-tiempo-real-configuracion.sql",
    "202609210002-add-ghl-advisor-auto-pause-time.sql",
    "202609230001-add-ghl-advisor-play-start-time.sql",
    "202609270001-add-ghl-flow-schedules.sql",
    "202609280001-add-ghl-flow-levels.sql",
  ];
  for (const migration of migrations) {
    const sql = fs.readFileSync(path.join(__dirname, "../migrations", migration), "utf8");
    await sequelize.query(sql);
  }
  const requiredColumns = [
    "horaInicioPlay",
    "horaPausaAutomatica",
    "horariosFlujoActivo",
    "horariosFlujo",
    "nivelesFlujo",
  ];
  const [columns] = await sequelize.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'ghl_reparto_tiempo_real_configuraciones'
      AND column_name IN (:requiredColumns)
  `, { replacements: { requiredColumns } });
  const found = new Set(columns.map((column) => column.column_name));
  const missing = requiredColumns.filter((column) => !found.has(column));
  if (missing.length) {
    throw new Error(`Faltan columnas GHL despues de migrar: ${missing.join(", ")}`);
  }
  console.log("Migracion de configuracion de reparto GHL en tiempo real aplicada y verificada");
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
