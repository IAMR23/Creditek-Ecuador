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

const addColumnIfMissing = async (
  queryInterface,
  tableName,
  columnName,
  definition
) => {
  const columns = await queryInterface.describeTable(tableName);

  if (!columns[columnName]) {
    await queryInterface.addColumn(tableName, columnName, definition);
  }
};

const ensureCierreCajaSchema = async (queryInterface, tables) => {
  if (!tables.includes("cierre_caja")) return;

  await addColumnIfMissing(queryInterface, "cierre_caja", "agenciaId", {
    type: Sequelize.INTEGER,
    allowNull: true,
    references: {
      model: "agencias",
      key: "id",
    },
    onUpdate: "CASCADE",
    onDelete: "SET NULL",
  });

  await addColumnIfMissing(queryInterface, "cierre_caja", "usuarioId", {
    type: Sequelize.INTEGER,
    allowNull: true,
    references: {
      model: "usuarios",
      key: "id",
    },
    onUpdate: "CASCADE",
    onDelete: "SET NULL",
  });

  await addColumnIfMissing(queryInterface, "cierre_caja", "usuarioCreacion", {
    type: Sequelize.STRING,
    allowNull: true,
  });

  await addColumnIfMissing(queryInterface, "cierre_caja", "usuarioModificacion", {
    type: Sequelize.STRING,
    allowNull: true,
  });

  await addColumnIfMissing(queryInterface, "cierre_caja", "fechaCreacion", {
    type: Sequelize.DATE,
    allowNull: true,
  });

  await addColumnIfMissing(queryInterface, "cierre_caja", "fechaModificacion", {
    type: Sequelize.DATE,
    allowNull: true,
  });

  await addColumnIfMissing(queryInterface, "cierre_caja", "observacionContabilidad", {
    type: Sequelize.STRING,
    allowNull: true,
  });

await addColumnIfMissing(queryInterface, "cierre_caja", "estadoCierre", {
  type: Sequelize.ENUM("CERRADO", "REABIERTO", "ANULADO"),
  allowNull: false,
  defaultValue: "CERRADO",
});

  await addColumnIfMissing(queryInterface, "cierre_caja", "reabiertoPorUsuarioId", {
    type: Sequelize.INTEGER,
    allowNull: true,
  });

  await addColumnIfMissing(queryInterface, "cierre_caja", "fechaReapertura", {
    type: Sequelize.DATE,
    allowNull: true,
  });

  await addColumnIfMissing(queryInterface, "cierre_caja", "motivoReapertura", {
    type: Sequelize.STRING,
    allowNull: true,
  });

  await addColumnIfMissing(queryInterface, "cierre_caja", "recerradoPorUsuarioId", {
    type: Sequelize.INTEGER,
    allowNull: true,
  });

  await addColumnIfMissing(queryInterface, "cierre_caja", "fechaRecierre", {
    type: Sequelize.DATE,
    allowNull: true,
  });

  if (tables.includes("usuario_agencia")) {
    await sequelize.query(`
      UPDATE cierre_caja AS c
      SET
        "usuarioId" = COALESCE(c."usuarioId", ua."usuarioId"),
        "agenciaId" = COALESCE(c."agenciaId", ua."agenciaId")
      FROM usuario_agencia AS ua
      WHERE c."usuarioAgenciaId" = ua.id
        AND (c."usuarioId" IS NULL OR c."agenciaId" IS NULL);
    `);
  }

  await sequelize.query(`
  UPDATE cierre_caja
  SET
    "estadoCierre" = COALESCE(
      "estadoCierre",
      'CERRADO'::"enum_cierre_caja_estadoCierre"
    ),
    "usuarioCreacion" = COALESCE("usuarioCreacion", "usuarioId"::text),
    "fechaCreacion" = COALESCE("fechaCreacion", "createdAt", NOW()),
    "usuarioModificacion" = COALESCE("usuarioModificacion", "usuarioId"::text),
    "fechaModificacion" = COALESCE("fechaModificacion", "updatedAt", NOW())
  WHERE "estadoCierre" IS NULL
    OR "usuarioCreacion" IS NULL
    OR "fechaCreacion" IS NULL
    OR "usuarioModificacion" IS NULL
    OR "fechaModificacion" IS NULL;
`);


  await sequelize.query(`
    WITH ranked AS (
      SELECT
        id,
        ROW_NUMBER() OVER (
          PARTITION BY "usuarioId", fecha
          ORDER BY "createdAt" DESC NULLS LAST, id DESC
        ) AS rn
      FROM cierre_caja
      WHERE "usuarioId" IS NOT NULL
        AND "estadoCierre" <> 'ANULADO'
    )
    UPDATE cierre_caja AS c
    SET 
      "estadoCierre" = 'ANULADO',
      "updatedAt" = NOW()
    FROM ranked AS r
    WHERE c.id = r.id
      AND r.rn > 1;
  `);

  await sequelize.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS cierre_caja_usuario_fecha_activo_unique
    ON cierre_caja ("usuarioId", fecha)
    WHERE "usuarioId" IS NOT NULL 
      AND "estadoCierre" <> 'ANULADO';
  `);
};

const ensureMovimientoCajaSchema = async (queryInterface, tables) => {
  if (tables.includes("movimiento_caja_temp")) {
    await addColumnIfMissing(queryInterface, "movimiento_caja_temp", "entidad", {
      type: Sequelize.STRING,
      allowNull: true,
    });
  }

  if (tables.includes("movimientos_caja")) {
    await addColumnIfMissing(queryInterface, "movimientos_caja", "entidad", {
      type: Sequelize.STRING,
      allowNull: true,
    });
  }
};

const ensureMarketingSchema = async (queryInterface, tables) => {
  if (tables.includes("presupuesto_marketing")) {
    const columnasPresupuestoMarketing =
      await queryInterface.describeTable("presupuesto_marketing");

    await addColumnIfMissing(queryInterface, "presupuesto_marketing", "fechaInicio", {
      type: Sequelize.DATEONLY,
      allowNull: true,
    });

    await addColumnIfMissing(queryInterface, "presupuesto_marketing", "fechaFin", {
      type: Sequelize.DATEONLY,
      allowNull: true,
    });

    await addColumnIfMissing(queryInterface, "presupuesto_marketing", "tipoModulo", {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: "MARKETING",
    });

    await sequelize.query(`
      UPDATE presupuesto_marketing
      SET "tipoModulo" = 'MARKETING'
      WHERE "tipoModulo" IS NULL;
    `);

    if (columnasPresupuestoMarketing.departamentoId) {
      await queryInterface.changeColumn("presupuesto_marketing", "departamentoId", {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "agencias",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      });

      await sequelize.query(`
        ALTER TABLE presupuesto_marketing
        ALTER COLUMN "departamentoId" DROP NOT NULL;
      `);
    }
  }

  if (tables.includes("gastos_marketing")) {
    const columnasGastosMarketing =
      await queryInterface.describeTable("gastos_marketing");

    await addColumnIfMissing(queryInterface, "gastos_marketing", "tipoModulo", {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: "MARKETING",
    });

    await sequelize.query(`
      UPDATE gastos_marketing
      SET "tipoModulo" = 'MARKETING'
      WHERE "tipoModulo" IS NULL;
    `);

    if (columnasGastosMarketing.departamentoId) {
      await queryInterface.changeColumn("gastos_marketing", "departamentoId", {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "agencias",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      });

      await sequelize.query(`
        ALTER TABLE gastos_marketing
        ALTER COLUMN "departamentoId" DROP NOT NULL;
      `);
    }
  }
};

const ensureSistemasTareasSchema = async (queryInterface, tables) => {
  if (!tables.includes("sistemas_tareas")) return;

  await addColumnIfMissing(queryInterface, "sistemas_tareas", "finalizadoEn", {
    type: Sequelize.DATE,
    allowNull: true,
  });

  await addColumnIfMissing(queryInterface, "sistemas_tareas", "fechaFin", {
    type: Sequelize.DATEONLY,
    allowNull: true,
  });

  await sequelize.query(`
    UPDATE sistemas_tareas
    SET "finalizadoEn" = COALESCE("finalizadoEn", "updatedAt", NOW())
    WHERE estado = 'finalizado'
      AND "finalizadoEn" IS NULL;
  `);

  await sequelize.query(`
    UPDATE sistemas_tareas
    SET "fechaFin" = DATE("finalizadoEn")
    WHERE estado = 'finalizado'
      AND "fechaFin" IS NULL
      AND "finalizadoEn" IS NOT NULL;
  `);
};

const ensureInventarioSistemasSchema = async (queryInterface, tables) => {
  if (!tables.includes("sistemas_inventarios")) return;

  await addColumnIfMissing(queryInterface, "sistemas_inventarios", "precio", {
    type: Sequelize.DECIMAL(12, 2),
    allowNull: true,
  });
};

const ensureSecretariosEjecutivosPlanesSchema = async (queryInterface, tables) => {
  if (!tables.includes("secretarios_ejecutivos_planes")) return;

  await addColumnIfMissing(
    queryInterface,
    "secretarios_ejecutivos_planes",
    "condicion",
    {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: "inexistencia",
    },
  );

  await addColumnIfMissing(
    queryInterface,
    "secretarios_ejecutivos_planes",
    "respuestasFormula",
    {
      type: Sequelize.JSONB,
      allowNull: false,
      defaultValue: {},
    },
  );

  await addColumnIfMissing(
    queryInterface,
    "secretarios_ejecutivos_planes",
    "detalle",
    {
      type: Sequelize.JSONB,
      allowNull: false,
      defaultValue: {},
    },
  );
};

const ensureUsuariosSchema = async (queryInterface, tables) => {
  if (!tables.includes("usuarios")) return;

  await addColumnIfMissing(queryInterface, "usuarios", "entidadFinanciera", {
    type: Sequelize.STRING,
    allowNull: true,
  });

  if (tables.includes("roles_pago")) {
    await addColumnIfMissing(queryInterface, "usuarios", "rolPagoId", {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: "roles_pago",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS usuarios_rol_pago_id_idx
      ON usuarios ("rolPagoId");
    `);
  }
};

const ensureNominaSchema = async (queryInterface, tables) => {
  if (!tables.includes("nomina_empleados")) return;

  await addColumnIfMissing(queryInterface, "nomina_empleados", "cargo", {
    type: Sequelize.STRING,
    allowNull: true,
  });

  if (tables.includes("roles_pago")) {
    await addColumnIfMissing(queryInterface, "nomina_empleados", "rolPagoId", {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: "roles_pago",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS nomina_empleados_rol_pago_id_idx
      ON nomina_empleados ("rolPagoId");
    `);
  }
};

const ensureRolesPagoSchema = async (tables) => {
  if (!tables.includes("roles_pago")) return;

  await sequelize.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS roles_pago_cargo_unique
    ON roles_pago (cargo);
  `);

  await sequelize.query(`
    CREATE INDEX IF NOT EXISTS roles_pago_nivel_activo_idx
    ON roles_pago (nivel, activo);
  `);
};

const ensureComisionesConfiguracionSchema = async (queryInterface, tables) => {
  if (!tables.includes("comisiones_configuracion")) return;

  if (tables.includes("roles_pago")) {
    await addColumnIfMissing(
      queryInterface,
      "comisiones_configuracion",
      "rolPagoId",
      {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "roles_pago",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
    );

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS comisiones_configuracion_rol_pago_idx
      ON comisiones_configuracion ("rolPagoId");
    `);
  }

  await sequelize.query(`
    CREATE INDEX IF NOT EXISTS comisiones_config_activo_idx
    ON comisiones_configuracion (activo);
  `);

  await sequelize.query(`
    CREATE INDEX IF NOT EXISTS comisiones_config_grupo_periodo_idx
    ON comisiones_configuracion (grupo, periodo);
  `);
};

const ensureMapaComercialSchema = async (tables) => {
  if (tables.includes("mapa_comercial_zonas")) {
    await sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS mapa_comercial_zonas_agencia_nombre_unique
      ON mapa_comercial_zonas ("agenciaId", nombre);
    `);

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS mapa_comercial_zonas_activo_agencia_idx
      ON mapa_comercial_zonas (activo, "agenciaId");
    `);
  }

  if (tables.includes("mapa_ubicaciones_normalizadas")) {
    await sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS mapa_ubicaciones_entidad_unique
      ON mapa_ubicaciones_normalizadas ("entidadTipo", "entidadId");
    `);

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS mapa_ubicaciones_estado_idx
      ON mapa_ubicaciones_normalizadas ("estadoGeocodificacion");
    `);
  }
};

const ensureDetalleEntregasUbicacionSchema = async (queryInterface, tables) => {
  if (!tables.includes("detalle_entregas")) return;

  const columns = await queryInterface.describeTable("detalle_entregas");

  if (!columns.identificadorAnuncio) {
    await queryInterface.addColumn("detalle_entregas", "identificadorAnuncio", {
      type: Sequelize.TEXT,
      allowNull: true,
    });
  }

  if (columns.ubicacion) {
    await queryInterface.changeColumn("detalle_entregas", "ubicacion", {
      type: Sequelize.TEXT,
      allowNull: true,
    });
  }

  if (columns.ubicacionDispositivo) {
    await queryInterface.changeColumn("detalle_entregas", "ubicacionDispositivo", {
      type: Sequelize.TEXT,
      allowNull: true,
    });
  }
}; 

const ensureControlFinancieroPreSyncSchema = async (queryInterface) => {
  const tables = await queryInterface.showAllTables();
  if (!tables.includes("control_financiero_cargas")) return;

  const columns = await queryInterface.describeTable("control_financiero_cargas");
  if (!columns.fechaReporte) {
    await queryInterface.addColumn(
      "control_financiero_cargas",
      "fechaReporte",
      {
        type: Sequelize.DATEONLY,
        allowNull: true,
      },
    );
  }

  if (!tables.includes("control_financiero_registros")) return;

  const registroColumns = await queryInterface.describeTable(
    "control_financiero_registros",
  );
  if (!registroColumns.archivoHash) {
    await queryInterface.addColumn(
      "control_financiero_registros",
      "archivoHash",
      {
        type: Sequelize.STRING(64),
        allowNull: true,
      },
    );
  }

  await sequelize.query(`
    UPDATE control_financiero_registros
    SET "archivoOrigen" = regexp_replace(
      "archivoOrigen",
      '^[0-9]{10,}-[a-f0-9]{8}-',
      '',
      'i'
    )
    WHERE "archivoOrigen" ~* '^[0-9]{10,}-[a-f0-9]{8}-';
  `);

  await sequelize.query(`
    WITH candidatas AS (
      SELECT
        "cargaId",
        id,
        substring(fecha FROM '[0-9]{1,2}/[0-9]{1,2}/[0-9]{2}') AS fecha_pdf
      FROM control_financiero_registros
      WHERE "tipoRegistro" = 'CAJA'
        AND fecha ~ '[0-9]{1,2}/[0-9]{1,2}/[0-9]{2}'
    ),
    primeras AS (
      SELECT DISTINCT ON ("cargaId")
        "cargaId",
        fecha_pdf
      FROM candidatas
      WHERE fecha_pdf IS NOT NULL
      ORDER BY "cargaId", id
    ),
    normalizadas AS (
      SELECT
        "cargaId",
        CASE
          WHEN split_part(fecha_pdf, '/', 1)::INTEGER > 12
            THEN to_date(fecha_pdf, 'DD/MM/YY')
          ELSE to_date(fecha_pdf, 'MM/DD/YY')
        END AS fecha_reporte
      FROM primeras
    )
    UPDATE control_financiero_cargas AS carga
    SET "fechaReporte" = normalizadas.fecha_reporte,
        "updatedAt" = NOW()
    FROM normalizadas
    WHERE carga.id = normalizadas."cargaId"
      AND carga."fechaReporte" IS NULL;
  `);
};

const connectDB = async () => {
  try {
    await sequelize.authenticate();
    console.log("Conectado a PostgreSQL exitosamente");

    const queryInterface = sequelize.getQueryInterface();
    await ensureControlFinancieroPreSyncSchema(queryInterface);
    await sequelize.sync({});

    const tables = await queryInterface.showAllTables();

    await ensureCierreCajaSchema(queryInterface, tables);
    await ensureMovimientoCajaSchema(queryInterface, tables);
    await ensureMarketingSchema(queryInterface, tables);
    await ensureSistemasTareasSchema(queryInterface, tables);
    await ensureInventarioSistemasSchema(queryInterface, tables);
    await ensureSecretariosEjecutivosPlanesSchema(queryInterface, tables);
    await ensureUsuariosSchema(queryInterface, tables);
    await ensureRolesPagoSchema(tables);
    await ensureComisionesConfiguracionSchema(queryInterface, tables);
    await ensureNominaSchema(queryInterface, tables);
    await ensureMapaComercialSchema(tables);
    await ensureDetalleEntregasUbicacionSchema(queryInterface, tables);
    const { seedRolesPago } = require("../seeders/rolesPagoSeeder");
    await seedRolesPago();
    const {
      seedComisionesConfiguracion,
    } = require("../seeders/comisionesConfiguracionSeeder");
    await seedComisionesConfiguracion();
    const { seedSancionesConfiguracion } = require("../seeders/sancionesConfiguracionSeeder");
    await seedSancionesConfiguracion();

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

      await addColumnIfMissing(queryInterface, "detalle_ventas", "identificadorAnuncio", {
        type: Sequelize.TEXT,
        allowNull: true,
      });

      await addColumnIfMissing(queryInterface, "detalle_ventas", "referenciaPdf", {
        type: Sequelize.STRING,
        allowNull: true,
      });

      const detalleVentaColumns = await queryInterface.describeTable("detalle_ventas");
      const columnasReferenciaAntiguas = ["codigoPdf", "imeiPdf"].filter(
        (column) => detalleVentaColumns[column],
      );

      if (columnasReferenciaAntiguas.length > 0) {
        const valoresReferencia = [
          'NULLIF("referenciaPdf", \'\')',
          ...columnasReferenciaAntiguas.map((column) => `NULLIF("${column}", '')`),
          "NULL",
        ].join(", ");

        await sequelize.query(`
          UPDATE detalle_ventas
          SET "referenciaPdf" = COALESCE(${valoresReferencia})
          WHERE "referenciaPdf" IS NULL OR "referenciaPdf" = '';
        `);
      }
    }

    if (tables.includes("costo_historicos")) {
      const columnasCostoHistorico = {
        precioCarga: {
          type: Sequelize.DECIMAL(10, 2),
          allowNull: true,
        },
        precioContado: {
          type: Sequelize.DECIMAL(10, 2),
          allowNull: true,
        },
        margen: {
          type: Sequelize.DECIMAL(10, 2),
          allowNull: true,
        },
        margenPorcentual: {
          type: Sequelize.DECIMAL(10, 2),
          allowNull: true,
        },
      };

      for (const [columnName, definition] of Object.entries(
        columnasCostoHistorico
      )) {
        await addColumnIfMissing(
          queryInterface,
          "costo_historicos",
          columnName,
          definition
        );
      }
    }

    if (
      tables.includes("usuarios_agencias_permisos") &&
      tables.includes("usuario_agencia") &&
      tables.includes("usuarios_permisos")
    ) {
      await sequelize.query(`
        INSERT INTO usuarios_permisos (
          usuario_id,
          permiso_id,
          activo,
          fecha_inicio,
          fecha_fin
        )
        SELECT DISTINCT
          ua."usuarioId",
          uap.permiso_id,
          uap.activo,
          uap.fecha_inicio,
          uap.fecha_fin
        FROM usuarios_agencias_permisos uap
        INNER JOIN usuario_agencia ua 
          ON ua.id = uap.usuario_agencia_id
        WHERE uap.activo = true
        ON CONFLICT (usuario_id, permiso_id) DO NOTHING;
      `);
    }

    if (tables.includes("usuarios") && tables.includes("usuarios_roles")) {
      await sequelize.query(`
        INSERT INTO usuarios_roles (
          usuario_id,
          rol_id,
          activo
        )
        SELECT
          id,
          "rolId",
          true
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

module.exports = {
  sequelize,
  connectDB,
};
