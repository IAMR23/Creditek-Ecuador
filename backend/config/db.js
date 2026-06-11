const { Sequelize } = require("sequelize");

const DB_NAME = process.env.DB_NAME || "CREDITEK";
const DB_USER = process.env.DB_USER || "postgres";
const DB_PASS = process.env.DB_PASS || "Creditk2025@.";
const DB_HOST = process.env.DB_HOST || "localhost";
const DB_PORT = process.env.DB_PORT || 5432;

const sequelize = new Sequelize(DB_NAME, DB_USER, DB_PASS, {
  host: DB_HOST,
  port: DB_PORT,
  dialect: "postgres",
  logging: false,
  timezone: "-05:00",
  dialectOptions: {
    useUTC: false,
  },
});

const addColumnIfMissing = async (queryInterface, tableName, columnName, definition) => {
  const columns = await queryInterface.describeTable(tableName);
  if (!columns[columnName]) {
    await queryInterface.addColumn(tableName, columnName, definition);
  }
};

const connectDB = async () => {
  try {
    await sequelize.authenticate();
    console.log("Conectado a PostgreSQL exitosamente");

    await sequelize.sync({});

    const queryInterface = sequelize.getQueryInterface();
    const tables = await queryInterface.showAllTables();

    if (tables.includes("precios_venta")) {
      await addColumnIfMissing(queryInterface, "precios_venta", "modeloId", {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "modelos",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      });
    }

    if (tables.includes("detalle_ventas")) {
      await addColumnIfMissing(queryInterface, "detalle_ventas", "precioVenta", {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
      });
    }

    if (tables.includes("costo_historicos")) {
      const columnasCostoHistorico = {
        precioCarga: { type: Sequelize.DECIMAL(10, 2), allowNull: true },
        precioContado: { type: Sequelize.DECIMAL(10, 2), allowNull: true },
        margen: { type: Sequelize.DECIMAL(10, 2), allowNull: true },
        margenPorcentual: { type: Sequelize.DECIMAL(10, 2), allowNull: true },
      };

      for (const [columnName, definition] of Object.entries(columnasCostoHistorico)) {
        await addColumnIfMissing(queryInterface, "costo_historicos", columnName, definition);
      }
    }

    if (
      tables.includes("usuarios_agencias_permisos") &&
      tables.includes("usuario_agencia") &&
      tables.includes("usuarios_permisos")
    ) {
      await sequelize.query(`
        INSERT INTO usuarios_permisos (usuario_id, permiso_id, activo, fecha_inicio, fecha_fin)
        SELECT DISTINCT ua."usuarioId", uap.permiso_id, uap.activo, uap.fecha_inicio, uap.fecha_fin
        FROM usuarios_agencias_permisos uap
        INNER JOIN usuario_agencia ua ON ua.id = uap.usuario_agencia_id
        WHERE uap.activo = true
        ON CONFLICT (usuario_id, permiso_id) DO NOTHING;
      `);
    }

    if (tables.includes("usuarios") && tables.includes("usuarios_roles")) {
      await sequelize.query(`
        INSERT INTO usuarios_roles (usuario_id, rol_id, activo)
        SELECT id, "rolId", true
        FROM usuarios
        WHERE "rolId" IS NOT NULL
        ON CONFLICT (usuario_id, rol_id) DO NOTHING;
      `);
    }

    console.log("Tablas sincronizadas correctamente");
  } catch (error) {
    console.error("Error de conexion o sincronizacion:", error);
    process.exit(1);
  }
};

module.exports = { sequelize, connectDB };
