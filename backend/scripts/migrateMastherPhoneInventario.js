const fs = require("fs");
const path = require("path");
require("dotenv").config();
const { sequelize } = require("../config/db");

async function run() {
  await sequelize.authenticate();
  const migrations = [
    "202610080004-create-logistica-masther-phone.sql",
    "202610080005-add-edicion-ingresos-masther-phone.sql",
    "202610080006-add-valores-ingresos-masther-phone.sql",
    "202610080007-ampliar-decimales-ingresos-masther-phone.sql",
  ];
  for (const migration of migrations) {
    const sql = fs.readFileSync(
      path.join(__dirname, "../migrations", migration),
      "utf8",
    );
    await sequelize.query(sql);
  }

  const [tables] = await sequelize.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN (
        'logistica_masther_phone_ingresos',
        'logistica_masther_phone_conciliaciones'
      )
    ORDER BY table_name;
  `);
  if (tables.length !== 2) {
    throw new Error("No se pudieron verificar las tablas de Masther Phone.");
  }

  const [constraints] = await sequelize.query(`
    SELECT conname
    FROM pg_constraint
    WHERE conname = 'logistica_masther_phone_ingresos_bodega_chk';
  `);
  if (constraints.length !== 1) {
    throw new Error("No se pudo verificar la restricción de bodega.");
  }

  const [uniqueIndexes] = await sequelize.query(`
    SELECT indexname
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname IN (
        'logistica_masther_phone_ingresos_request_key_uk',
        'logistica_masther_phone_conciliaciones_modelo_semana_uk'
      );
  `);
  if (uniqueIndexes.length !== 2) {
    throw new Error("No se pudieron verificar los índices contra duplicados.");
  }
  const [auditColumns] = await sequelize.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'logistica_masther_phone_ingresos'
      AND column_name = 'actualizadoPorId';
  `);
  if (auditColumns.length !== 1) {
    throw new Error("No se pudo verificar la auditoría de edición.");
  }
  const [amountColumns] = await sequelize.query(`
    SELECT column_name, numeric_scale
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'logistica_masther_phone_ingresos'
      AND column_name IN ('precioUnitario', 'subtotal', 'iva', 'total');
  `);
  if (
    amountColumns.length !== 4 ||
    amountColumns.some((column) => Number(column.numeric_scale) !== 6)
  ) {
    throw new Error("No se pudieron verificar los valores monetarios.");
  }
  console.log("Migración de inventario Masther Phone aplicada y verificada.");
}

run()
  .catch((error) => {
    console.error("No se pudo aplicar la migración de Masther Phone", {
      code: error.original?.code || error.code || "MASTHER_PHONE_MIGRATION_ERROR",
      message: error.original?.message || error.message,
    });
    process.exitCode = 1;
  })
  .finally(() => sequelize.close().catch(() => {}));
