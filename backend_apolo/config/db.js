const { Sequelize } = require("sequelize");

const DB_NAME = process.env.DB_NAME || "APOLO";
const DB_USER = process.env.DB_USER || "postgres";
const DB_PASS = process.env.DB_PASS || "apolo_password";
const DB_HOST = process.env.DB_HOST || "localhost";
const DB_PORT = process.env.DB_PORT || 5432;

const sequelize = new Sequelize(DB_NAME, DB_USER, DB_PASS, {
  host: DB_HOST,
  port: DB_PORT,
  dialect: "postgres",
  logging: false,
  timezone: "-05:00",
  dialectOptions: { useUTC: false },
});

const ensureUsuarioLoginSchema = async () => {
  const queryInterface = sequelize.getQueryInterface();
  const tables = await queryInterface.showAllTables();
  if (!tables.includes("usuarios")) return;

  const columns = await queryInterface.describeTable("usuarios");
  if (!columns.usuario) {
    await queryInterface.addColumn("usuarios", "usuario", {
      type: Sequelize.STRING(50),
      allowNull: true,
    });
  }

  await sequelize.query(`
    WITH candidatos AS (
      SELECT
        id,
        CASE
          WHEN LENGTH(
            REGEXP_REPLACE(
              LOWER(SPLIT_PART(email, '@', 1)),
              '[^a-z0-9._-]',
              '',
              'g'
            )
          ) >= 3
          THEN LEFT(
            REGEXP_REPLACE(
              LOWER(SPLIT_PART(email, '@', 1)),
              '[^a-z0-9._-]',
              '',
              'g'
            ),
            38
          )
          ELSE 'usuario'
        END AS base
      FROM usuarios
      WHERE usuario IS NULL OR BTRIM(usuario) = ''
    ),
    repetidos AS (
      SELECT
        id,
        base,
        COUNT(*) OVER (PARTITION BY base) AS total
      FROM candidatos
    )
    UPDATE usuarios AS u
    SET usuario = CASE
      WHEN r.total = 1
        AND NOT EXISTS (
          SELECT 1
          FROM usuarios AS existente
          WHERE existente.id <> r.id
            AND LOWER(existente.usuario) = r.base
        )
      THEN r.base
      ELSE LEFT(r.base, 38) || '_' || r.id::text
    END
    FROM repetidos AS r
    WHERE u.id = r.id;
  `);

  await sequelize.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS usuarios_usuario_lower_unique
    ON usuarios (LOWER(usuario))
    WHERE usuario IS NOT NULL;
  `);
};

const connectDB = async () => {
  await sequelize.authenticate();
  await sequelize.sync({ alter: true });
  await ensureUsuarioLoginSchema();
};

module.exports = { sequelize, connectDB, ensureUsuarioLoginSchema };
