const fs = require("fs");
const path = require("path");
require("dotenv").config();
const { sequelize } = require("../config/db");

const MARCADOR_INDICES = "-- MIGRATION_CONCURRENT_INDEXES";
const INDICES_ESPERADOS = [
  "control_financiero_registros_imei_normalizado_idx",
  "control_financiero_registros_contrato_normalizado_idx",
  "detalle_ventas_venta_id_idx",
  "clientes_cedula_normalizada_reporte_idx",
  "ventas_cliente_activa_idx",
  "entregas_venta_id_idx",
];

const separarSentenciasSimples = (sql) =>
  sql
    .split(/;\s*(?:\r?\n|$)/)
    .map((sentencia) => sentencia.trim())
    .filter((sentencia) => sentencia && !/^--[^\n]*$/.test(sentencia));

async function run() {
  const migrationPath = path.join(
    __dirname,
    "../migrations/202609180001-optimize-ventas-con-entrega.sql",
  );
  const sql = fs.readFileSync(migrationPath, "utf8");
  const [esquemaYBackfill, indicesYVerificacion] = sql.split(MARCADOR_INDICES);

  if (!indicesYVerificacion) {
    throw new Error("La migracion no contiene el marcador de indices concurrentes.");
  }

  await sequelize.authenticate();
  await sequelize.query(esquemaYBackfill);

  for (const sentencia of separarSentenciasSimples(indicesYVerificacion)) {
    await sequelize.query(sentencia);
  }

  const [indices] = await sequelize.query(
    `
      SELECT indice.relname AS nombre, estado.indisvalid AS valido
      FROM pg_class indice
      INNER JOIN pg_index estado ON estado.indexrelid = indice.oid
      WHERE indice.relname IN (:indices)
    `,
    { replacements: { indices: INDICES_ESPERADOS } },
  );
  const validos = new Set(
    indices.filter((indice) => indice.valido).map((indice) => indice.nombre),
  );
  const faltantesOInvalidos = INDICES_ESPERADOS.filter(
    (indice) => !validos.has(indice),
  );
  if (faltantesOInvalidos.length) {
    throw new Error(
      `Indices faltantes o invalidos: ${faltantesOInvalidos.join(", ")}`,
    );
  }

  console.log("Migracion de ventas con entrega aplicada correctamente.");
}

run()
  .catch((error) => {
    console.error("No se pudo aplicar la migracion de ventas con entrega", {
      code: error.original?.code || error.code || "VENTAS_ENTREGA_MIGRATION_ERROR",
      message: String(error.message || "Error de migracion").slice(0, 300),
    });
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close().catch(() => {});
  });
