const fs = require("fs");
const path = require("path");
require("dotenv").config();
const { sequelize } = require("../config/db");

async function run() {
  const migrationPath = path.join(
    __dirname,
    "../migrations/202609180002-create-sistemas-tickets.sql",
  );
  const sql = fs.readFileSync(migrationPath, "utf8");
  await sequelize.authenticate();
  await sequelize.query(sql);

  const [tables] = await sequelize.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN (
        'sistemas_tickets',
        'sistemas_ticket_comentarios',
        'sistemas_ticket_archivos',
        'sistemas_ticket_historial'
      )
  `);
  if (tables.length !== 4) {
    throw new Error("La migración no creó todas las tablas de Tickets de TI");
  }
  console.log("Migración de Tickets de TI aplicada correctamente.");
}

run()
  .catch((error) => {
    console.error("No se pudo aplicar la migración de Tickets de TI", {
      code: error.original?.code || error.code || "TICKETS_TI_MIGRATION_ERROR",
      message: String(error.message || "Error de migración").slice(0, 300),
    });
    process.exitCode = 1;
  })
  .finally(async () => sequelize.close().catch(() => {}));
