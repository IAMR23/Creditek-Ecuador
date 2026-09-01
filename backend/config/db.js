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
    await addColumnIfMissing(queryInterface, "movimiento_caja_temp", "clienteId", {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: "clientes",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });
  }

  if (tables.includes("movimientos_caja")) {
    await addColumnIfMissing(queryInterface, "movimientos_caja", "entidad", {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await addColumnIfMissing(queryInterface, "movimientos_caja", "clienteId", {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: "clientes",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });
  }
};

const ensureDenominacionesCajaSchema = async (tables) => {
  if (tables.includes("denominaciones_caja_temp")) {
    await sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS denominaciones_caja_temp_activa_unique
      ON denominaciones_caja_temp ("usuarioAgenciaId", valor)
      WHERE estado = 'ACTIVO';
    `);

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS denominaciones_caja_temp_usuario_agencia_idx
      ON denominaciones_caja_temp ("usuarioAgenciaId", estado);
    `);
  }

  if (tables.includes("denominaciones_caja_historial")) {
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS denominaciones_caja_historial_usuario_agencia_idx
      ON denominaciones_caja_historial ("usuarioAgenciaId", "fechaSnapshot");
    `);

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS denominaciones_caja_historial_cierre_idx
      ON denominaciones_caja_historial ("cierreId");
    `);
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

  if (tables.includes("pautas_marketing")) {
    await addColumnIfMissing(
      queryInterface,
      "pautas_marketing",
      "contenidos",
      {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: [],
      },
    );

    await sequelize.query(`
      UPDATE pautas_marketing
      SET contenidos = jsonb_build_array(
        jsonb_build_object(
          'producto', producto,
          'tipoContenido', "tipoContenido"
        )
      )
      WHERE COALESCE(contenidos, '[]'::jsonb) = '[]'::jsonb
        AND producto IS NOT NULL
        AND "tipoContenido" IS NOT NULL;
    `);
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

const ensurePersonasSchema = async (queryInterface, tables) => {
  if (tables.includes("roles")) {
    await sequelize.query(`
      UPDATE roles
      SET activo = TRUE,
          descripcion = COALESCE(descripcion, 'Promotor comercial'),
          "updatedAt" = NOW()
      WHERE LOWER(BTRIM(nombre)) = 'promotor';

      INSERT INTO roles (nombre, descripcion, activo, "createdAt", "updatedAt")
      SELECT
        'promotor',
        'Promotor comercial',
        TRUE,
        NOW(),
        NOW()
      WHERE NOT EXISTS (
        SELECT 1
        FROM roles
        WHERE LOWER(BTRIM(nombre)) = 'promotor'
      );
    `);
  }

  if (!tables.includes("clientes")) return;

  const columnasClientes = await queryInterface.describeTable("clientes");
  if (columnasClientes.cliente && !columnasClientes.cliente.allowNull) {
    await queryInterface.changeColumn("clientes", "cliente", {
      type: Sequelize.STRING,
      allowNull: true,
    });
  }

  await addColumnIfMissing(queryInterface, "clientes", "rolId", {
    type: Sequelize.INTEGER,
    allowNull: true,
    references: {
      model: "roles",
      key: "id",
    },
    onUpdate: "CASCADE",
    onDelete: "SET NULL",
  });

  await sequelize.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint AS constraint_data
        INNER JOIN pg_attribute AS attribute_data
          ON attribute_data.attrelid = constraint_data.conrelid
         AND attribute_data.attnum = ANY(constraint_data.conkey)
        WHERE constraint_data.contype = 'f'
          AND constraint_data.conrelid = 'clientes'::regclass
          AND attribute_data.attname = 'rolId'
      ) THEN
        ALTER TABLE clientes
        ADD CONSTRAINT clientes_rol_id_fkey
        FOREIGN KEY ("rolId") REFERENCES roles(id)
        ON UPDATE CASCADE ON DELETE SET NULL;
      END IF;
    END $$;

    CREATE INDEX IF NOT EXISTS clientes_cedula_normalizada_idx
    ON clientes (BTRIM(cedula))
    WHERE cedula IS NOT NULL AND BTRIM(cedula) <> '';

    CREATE INDEX IF NOT EXISTS clientes_telefono_normalizado_idx
    ON clientes (BTRIM(telefono))
    WHERE telefono IS NOT NULL AND BTRIM(telefono) <> '';

    CREATE INDEX IF NOT EXISTS clientes_rol_id_idx
    ON clientes ("rolId");
  `);

  if (!tables.includes("gestionesComerciales")) return;

  await addColumnIfMissing(
    queryInterface,
    "gestionesComerciales",
    "clienteId",
    {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: "clientes",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    },
  );

  await sequelize.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint AS constraint_data
        INNER JOIN pg_attribute AS attribute_data
          ON attribute_data.attrelid = constraint_data.conrelid
         AND attribute_data.attnum = ANY(constraint_data.conkey)
        WHERE constraint_data.contype = 'f'
          AND constraint_data.conrelid = '"gestionesComerciales"'::regclass
          AND attribute_data.attname = 'clienteId'
      ) THEN
        ALTER TABLE "gestionesComerciales"
        ADD CONSTRAINT gestiones_comerciales_cliente_id_fkey
        FOREIGN KEY ("clienteId") REFERENCES clientes(id)
        ON UPDATE CASCADE ON DELETE SET NULL;
      END IF;
    END $$;

    CREATE INDEX IF NOT EXISTS gestiones_comerciales_cliente_id_idx
    ON "gestionesComerciales" ("clienteId");

    WITH prospectos_con_cedula AS (
      SELECT DISTINCT ON (NULLIF(BTRIM("cedulaGestionado"), ''))
        NULLIF(BTRIM("cedulaGestionado"), '') AS cedula,
        NULLIF(BTRIM("celularGestionado"), '') AS telefono
      FROM "gestionesComerciales"
      WHERE NULLIF(BTRIM("cedulaGestionado"), '') IS NOT NULL
      ORDER BY NULLIF(BTRIM("cedulaGestionado"), ''), id
    )
    UPDATE clientes AS cliente
    SET cedula = prospecto.cedula,
        "updatedAt" = NOW()
    FROM prospectos_con_cedula AS prospecto
    WHERE prospecto.cedula IS NOT NULL
      AND prospecto.telefono IS NOT NULL
      AND NULLIF(BTRIM(cliente.cedula), '') IS NULL
      AND BTRIM(cliente.telefono) = prospecto.telefono
      AND NOT EXISTS (
        SELECT 1
        FROM clientes AS existente
        WHERE NULLIF(BTRIM(existente.cedula), '') = prospecto.cedula
      );

    WITH prospectos AS (
      SELECT DISTINCT ON (COALESCE(
        NULLIF(BTRIM("cedulaGestionado"), ''),
        'TEL:' || NULLIF(BTRIM("celularGestionado"), '')
      ))
        NULLIF(BTRIM("cedulaGestionado"), '') AS cedula,
        NULLIF(BTRIM("celularGestionado"), '') AS telefono
      FROM "gestionesComerciales"
      WHERE NULLIF(BTRIM("cedulaGestionado"), '') IS NOT NULL
         OR NULLIF(BTRIM("celularGestionado"), '') IS NOT NULL
      ORDER BY COALESCE(
        NULLIF(BTRIM("cedulaGestionado"), ''),
        'TEL:' || NULLIF(BTRIM("celularGestionado"), '')
      ), id
    )
    INSERT INTO clientes (
      cliente,
      cedula,
      telefono,
      correo,
      direccion,
      "createdAt",
      "updatedAt"
    )
    SELECT
      NULL,
      prospecto.cedula,
      prospecto.telefono,
      NULL,
      NULL,
      NOW(),
      NOW()
    FROM prospectos AS prospecto
    WHERE NOT EXISTS (
      SELECT 1
      FROM clientes AS existente
      WHERE NULLIF(BTRIM(existente.cedula), '') = prospecto.cedula
         OR (
           prospecto.telefono IS NOT NULL
           AND NULLIF(BTRIM(existente.telefono), '') = prospecto.telefono
           AND NULLIF(BTRIM(existente.cedula), '') IS NULL
         )
    );

    WITH prospectos_solo_telefono AS (
      SELECT DISTINCT ON (NULLIF(BTRIM("celularGestionado"), ''))
        NULLIF(BTRIM("celularGestionado"), '') AS telefono
      FROM "gestionesComerciales"
      WHERE NULLIF(BTRIM("cedulaGestionado"), '') IS NULL
        AND NULLIF(BTRIM("celularGestionado"), '') IS NOT NULL
      ORDER BY NULLIF(BTRIM("celularGestionado"), ''), id
    )
    INSERT INTO clientes (
      cliente,
      cedula,
      telefono,
      correo,
      direccion,
      "createdAt",
      "updatedAt"
    )
    SELECT NULL, NULL, prospecto.telefono, NULL, NULL, NOW(), NOW()
    FROM prospectos_solo_telefono AS prospecto
    WHERE NOT EXISTS (
      SELECT 1
      FROM clientes AS existente
      WHERE NULLIF(BTRIM(existente.telefono), '') = prospecto.telefono
    );

    WITH relaciones AS (
      SELECT
        gestion.id AS gestion_id,
        COALESCE(
          (
            SELECT persona.id
            FROM clientes AS persona
            WHERE NULLIF(BTRIM(gestion."cedulaGestionado"), '') IS NOT NULL
              AND NULLIF(BTRIM(persona.cedula), '') = NULLIF(BTRIM(gestion."cedulaGestionado"), '')
            ORDER BY persona.id
            LIMIT 1
          ),
          (
            SELECT persona.id
            FROM clientes AS persona
            WHERE NULLIF(BTRIM(gestion."celularGestionado"), '') IS NOT NULL
              AND NULLIF(BTRIM(persona.telefono), '') = NULLIF(BTRIM(gestion."celularGestionado"), '')
            ORDER BY
              CASE WHEN NULLIF(BTRIM(persona.cedula), '') IS NULL THEN 0 ELSE 1 END,
              persona.id
            LIMIT 1
          )
        ) AS persona_id
      FROM "gestionesComerciales" AS gestion
      WHERE gestion."clienteId" IS NULL
    )
    UPDATE "gestionesComerciales" AS gestion
    SET "clienteId" = relaciones.persona_id,
        "updatedAt" = NOW()
    FROM relaciones
    WHERE gestion.id = relaciones.gestion_id
      AND relaciones.persona_id IS NOT NULL;
  `);
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

const ensurePlanesBatallaSchema = async (queryInterface, tables) => {
  if (!tables.includes("planes_batalla")) return;

  await addColumnIfMissing(
    queryInterface,
    "planes_batalla",
    "claveIdempotencia",
    {
      type: Sequelize.STRING(64),
      allowNull: true,
    },
  );

  await sequelize.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS planes_batalla_usuario_clave_idempotencia_unique
    ON planes_batalla ("usuarioAgenciaId", "claveIdempotencia")
    WHERE "claveIdempotencia" IS NOT NULL;
  `);
};

const ensureUsuariosSchema = async (queryInterface, tables) => {
  if (!tables.includes("usuarios")) return;

  await addColumnIfMissing(
    queryInterface,
    "usuarios",
    "fechaSalidaRegistradaAt",
    {
      type: Sequelize.DATE,
      allowNull: true,
    },
  );

  await addColumnIfMissing(queryInterface, "usuarios", "usuario", {
    type: Sequelize.STRING(50),
    allowNull: true,
  });

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

const ensurePagosComisionesSchema = async (queryInterface, tables) => {
  if (!tables.includes("pagos_comisiones_multas_ajustes")) return;

  await addColumnIfMissing(
    queryInterface,
    "pagos_comisiones_multas_ajustes",
    "valorDescontar",
    {
      type: Sequelize.DECIMAL(12, 2),
      allowNull: true,
    },
  );
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

  await addColumnIfMissing(queryInterface, "control_financiero_cargas", "estado", {
    type: Sequelize.STRING(20),
    allowNull: false,
    defaultValue: "ACTIVA",
  });
  await addColumnIfMissing(
    queryInterface,
    "control_financiero_cargas",
    "motivoAnulacion",
    {
      type: Sequelize.TEXT,
      allowNull: true,
    },
  );
  await addColumnIfMissing(
    queryInterface,
    "control_financiero_cargas",
    "anuladoPor",
    {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: "usuarios",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    },
  );
  await addColumnIfMissing(
    queryInterface,
    "control_financiero_cargas",
    "anuladoEn",
    {
      type: Sequelize.DATE,
      allowNull: true,
    },
  );

  await sequelize.query(`
    UPDATE control_financiero_cargas
    SET estado = 'ACTIVA'
    WHERE estado IS NULL;
  `);

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

  await addColumnIfMissing(
    queryInterface,
    "control_financiero_registros",
    "estadoPagoEntrada",
    {
      type: Sequelize.STRING(20),
      allowNull: false,
      defaultValue: "PENDIENTE",
    },
  );
  await addColumnIfMissing(
    queryInterface,
    "control_financiero_registros",
    "responsablePagoEntradaId",
    {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: "usuarios",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    },
  );
  await addColumnIfMissing(
    queryInterface,
    "control_financiero_registros",
    "observacionPagoEntrada",
    {
      type: Sequelize.TEXT,
      allowNull: true,
    },
  );

  await sequelize.query(`
    UPDATE control_financiero_registros
    SET "estadoPagoEntrada" = 'PENDIENTE'
    WHERE "estadoPagoEntrada" IS NULL;
  `);

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

const ensureControlFinancieroConciliacionManualCajaSchema = async (tables) => {
  if (
    !tables.includes("control_financiero_conciliaciones_manual") ||
    !tables.includes("control_financiero_conciliaciones_manual_detalle")
  ) {
    return;
  }

  await sequelize.query(`
    ALTER TABLE control_financiero_conciliaciones_manual
    ADD COLUMN IF NOT EXISTS "relacionAnteriorId" BIGINT NULL;

    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'control_financiero_conciliaciones_manual_detalle_lado_chk'
      ) THEN
        ALTER TABLE control_financiero_conciliaciones_manual_detalle
        ADD CONSTRAINT control_financiero_conciliaciones_manual_detalle_lado_chk
        CHECK (
          (
            tipo = 'REPORTE'
            AND "registroReporteId" IS NOT NULL
            AND "movimientoCajaId" IS NULL
          )
          OR
          (
            tipo = 'CIERRE'
            AND "movimientoCajaId" IS NOT NULL
            AND "registroReporteId" IS NULL
          )
        );
      END IF;

      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'control_financiero_conciliaciones_manual_detalle_tipo_chk'
      ) THEN
        ALTER TABLE control_financiero_conciliaciones_manual_detalle
        ADD CONSTRAINT control_financiero_conciliaciones_manual_detalle_tipo_chk
        CHECK (tipo IN ('REPORTE', 'CIERRE'));
      END IF;
    END $$;

    CREATE UNIQUE INDEX IF NOT EXISTS cf_conc_manual_detalle_reporte_activo_uq
    ON control_financiero_conciliaciones_manual_detalle ("registroReporteId")
    WHERE activo IS TRUE AND tipo = 'REPORTE';

    CREATE UNIQUE INDEX IF NOT EXISTS cf_conc_manual_detalle_cierre_activo_uq
    ON control_financiero_conciliaciones_manual_detalle ("movimientoCajaId")
    WHERE activo IS TRUE AND tipo = 'CIERRE';
  `);
};

const ensureConsejoEjecutivoPreSyncSchema = async (queryInterface) => {
  const tables = await queryInterface.showAllTables();
  if (!tables.includes("consejo_ejecutivo_planes")) return;

  // sequelize.sync() crea los indices declarados por el modelo incluso cuando
  // la tabla ya existe. La columna debe estar presente antes de ese paso.
  await addColumnIfMissing(
    queryInterface,
    "consejo_ejecutivo_planes",
    "salaId",
    {
      type: Sequelize.INTEGER,
      allowNull: true,
    },
  );
};

const ensureReporteCajaUsuarioAgenciaPreSyncSchema = async (queryInterface) => {
  const tables = await queryInterface.showAllTables();
  if (!tables.includes("reporte_caja_usuario_agencia")) return;

  await addColumnIfMissing(
    queryInterface,
    "reporte_caja_usuario_agencia",
    "fechaDesde",
    {
      type: Sequelize.DATEONLY,
      allowNull: true,
    },
  );
  await addColumnIfMissing(
    queryInterface,
    "reporte_caja_usuario_agencia",
    "fechaHasta",
    {
      type: Sequelize.DATEONLY,
      allowNull: true,
    },
  );

  await sequelize.query(`
    UPDATE reporte_caja_usuario_agencia
    SET "fechaDesde" = DATE '2000-01-01'
    WHERE "fechaDesde" IS NULL;

    ALTER TABLE reporte_caja_usuario_agencia
      ALTER COLUMN "fechaDesde" SET DEFAULT DATE '2000-01-01',
      ALTER COLUMN "fechaDesde" SET NOT NULL;

    DO $$
    DECLARE
      restriccion RECORD;
      indice RECORD;
    BEGIN
      FOR restriccion IN
        SELECT con.conname
        FROM pg_constraint con
        JOIN pg_class tabla ON tabla.oid = con.conrelid
        WHERE tabla.relname = 'reporte_caja_usuario_agencia'
          AND con.contype = 'u'
          AND pg_get_constraintdef(con.oid) = 'UNIQUE ("codigoUsuario")'
      LOOP
        EXECUTE format(
          'ALTER TABLE reporte_caja_usuario_agencia DROP CONSTRAINT %I',
          restriccion.conname
        );
      END LOOP;

      FOR indice IN
        SELECT indexname
        FROM pg_indexes
        WHERE tablename = 'reporte_caja_usuario_agencia'
          AND (
            (
              indexdef LIKE 'CREATE UNIQUE INDEX%'
              AND indexdef LIKE '%("codigoUsuario")'
            )
            OR indexname LIKE 'reporte_caja_usuario_agencia_codigo_usuario_fecha_desde_fecha%'
          )
      LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', indice.indexname);
      END LOOP;
    END $$;

    CREATE UNIQUE INDEX IF NOT EXISTS reporte_caja_usuario_agencia_codigo_desde_uidx
    ON reporte_caja_usuario_agencia ("codigoUsuario", "fechaDesde");

    CREATE INDEX IF NOT EXISTS reporte_caja_usuario_agencia_activo_agencia_idx
    ON reporte_caja_usuario_agencia (activo, "agenciaId");

    CREATE INDEX IF NOT EXISTS reporte_caja_usuario_agencia_codigo_vigencia_idx
    ON reporte_caja_usuario_agencia ("codigoUsuario", "fechaDesde", "fechaHasta");
  `);
};

const ensureRolesCreditekResumenSchema = async (queryInterface, tables) => {
  if (!tables.includes("roles_creditek_ajustes")) return;

  const columnasValor = [
    "adelantosTransfer",
    "deudaJimena",
    "atrasos",
    "diasNoLaborables",
    "multasFacturacion",
    "planmovi",
    "prestamo",
    "mecanica",
    "pagosLentes",
    "sueldo",
  ];

  for (const columnName of columnasValor) {
    await addColumnIfMissing(
      queryInterface,
      "roles_creditek_ajustes",
      columnName,
      {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0,
      },
    );
  }

  const columnasCalculadasManuales = [
    "descuentosMetaManual",
    "cajaGeneralManual",
    "entradasManual",
    "descuentosManual",
    "multasFacturacionManual",
  ];
  const columnasActuales = await queryInterface.describeTable(
    "roles_creditek_ajustes",
  );
  const debeMigrarMultasFacturacion =
    !columnasActuales.multasFacturacionManual;

  for (const columnName of columnasCalculadasManuales) {
    await addColumnIfMissing(
      queryInterface,
      "roles_creditek_ajustes",
      columnName,
      {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: true,
      },
    );
  }

  if (debeMigrarMultasFacturacion) {
    await sequelize.query(`
      UPDATE roles_creditek_ajustes
      SET "multasFacturacionManual" = "multasFacturacion"
      WHERE "multasFacturacionManual" IS NULL
        AND "multasFacturacion" <> 0;
    `);
  }

  await sequelize.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS roles_creditek_ajustes_usuario_periodo_unique
    ON roles_creditek_ajustes ("usuarioId", anio, mes);
  `);

  await sequelize.query(`
    CREATE INDEX IF NOT EXISTS roles_creditek_ajustes_periodo_idx
    ON roles_creditek_ajustes (anio, mes);
  `);
};

const ensureEgresosCreditekEntradasPreSyncSchema = async (queryInterface) => {
  const tables = await queryInterface.showAllTables();
  if (!tables.includes("egresos_creditek_entradas")) return;

  await addColumnIfMissing(
    queryInterface,
    "egresos_creditek_entradas",
    "observacion",
    {
      type: Sequelize.TEXT,
      allowNull: true,
    },
  );
  await addColumnIfMissing(
    queryInterface,
    "egresos_creditek_entradas",
    "fecha",
    {
      type: Sequelize.DATEONLY,
      allowNull: true,
    },
  );
  await addColumnIfMissing(
    queryInterface,
    "egresos_creditek_entradas",
    "seccion",
    {
      type: Sequelize.STRING(30),
      allowNull: false,
      defaultValue: "ENTRADAS",
    },
  );
  await addColumnIfMissing(
    queryInterface,
    "egresos_creditek_entradas",
    "activo",
    {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  );
  await addColumnIfMissing(
    queryInterface,
    "egresos_creditek_entradas",
    "ultimaAccion",
    {
      type: Sequelize.STRING(20),
      allowNull: false,
      defaultValue: "CREADO",
    },
  );
  await addColumnIfMissing(
    queryInterface,
    "egresos_creditek_entradas",
    "actualizadoPorId",
    {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: "usuarios", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    },
  );
  await sequelize.query(`
    UPDATE egresos_creditek_entradas
    SET seccion = COALESCE(seccion, 'ENTRADAS'),
        activo = COALESCE(activo, TRUE),
        "ultimaAccion" = COALESCE("ultimaAccion", 'CREADO')
    WHERE seccion IS NULL
       OR activo IS NULL
       OR "ultimaAccion" IS NULL;
  `);
  await sequelize.query(`
    CREATE INDEX IF NOT EXISTS egresos_creditek_entradas_seccion_idx
    ON egresos_creditek_entradas (seccion);
  `);
  await sequelize.query(`
    CREATE INDEX IF NOT EXISTS egresos_creditek_entradas_fecha_idx
    ON egresos_creditek_entradas (fecha);
  `);
};

const ensureFacturasFisicasOcrPreSyncSchema = async (queryInterface) => {
  const tables = await queryInterface.showAllTables();
  if (!tables.includes("facturas_fisicas")) return;

  // FacturaFisica declara un indice OCR. Sus columnas deben existir antes de
  // sequelize.sync() para que el arranque sea seguro aun si la migracion se
  // aplica durante el despliegue y no antes de iniciar el proceso Node.
  const columns = [
    [
      "ocrEstado",
      {
        type: Sequelize.STRING(40),
        allowNull: false,
        defaultValue: "NO_PROCESADO",
      },
    ],
    ["ocrTexto", { type: Sequelize.TEXT, allowNull: true }],
    ["ocrCampos", { type: Sequelize.JSONB, allowNull: true }],
    [
      "ocrAdvertencias",
      { type: Sequelize.JSONB, allowNull: false, defaultValue: [] },
    ],
    ["ocrMetadata", { type: Sequelize.JSONB, allowNull: true }],
    ["ocrError", { type: Sequelize.TEXT, allowNull: true }],
    ["ocrProcesadoEn", { type: Sequelize.DATE, allowNull: true }],
    [
      "ocrProcesadoPorId",
      {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "usuarios", key: "id" },
      },
    ],
    ["ocrMotor", { type: Sequelize.STRING(80), allowNull: true }],
    ["ocrVersion", { type: Sequelize.STRING(40), allowNull: true }],
    [
      "ocrHistorial",
      { type: Sequelize.JSONB, allowNull: false, defaultValue: [] },
    ],
    ["ocrProcesamientoToken", { type: Sequelize.UUID, allowNull: true }],
  ];

  for (const [columnName, definition] of columns) {
    await addColumnIfMissing(
      queryInterface,
      "facturas_fisicas",
      columnName,
      definition,
    );
  }
};

const ensureConsejoEjecutivoSchema = async (tables) => {
  if (
    !tables.includes("consejo_ejecutivo_planes") ||
    !tables.includes("consejo_ejecutivo_salas")
  ) {
    return;
  }

  await sequelize.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint AS constraint_info
        JOIN LATERAL unnest(constraint_info.conkey) AS key_column(attnum)
          ON TRUE
        JOIN pg_attribute AS attribute_info
          ON attribute_info.attrelid = constraint_info.conrelid
         AND attribute_info.attnum = key_column.attnum
        WHERE constraint_info.contype = 'f'
          AND constraint_info.conrelid = 'consejo_ejecutivo_planes'::regclass
          AND attribute_info.attname = 'salaId'
      ) THEN
        ALTER TABLE consejo_ejecutivo_planes
          ADD CONSTRAINT consejo_ejecutivo_planes_sala_id_fkey
          FOREIGN KEY ("salaId") REFERENCES consejo_ejecutivo_salas(id)
          ON UPDATE CASCADE ON DELETE RESTRICT;
      END IF;
    END $$;
  `);
};

const connectDB = async () => {
  try {
    await sequelize.authenticate();
    console.log("Conectado a PostgreSQL exitosamente");

    const queryInterface = sequelize.getQueryInterface();
    await ensureControlFinancieroPreSyncSchema(queryInterface);
    await ensureConsejoEjecutivoPreSyncSchema(queryInterface);
    await ensureFacturasFisicasOcrPreSyncSchema(queryInterface);
    await ensureReporteCajaUsuarioAgenciaPreSyncSchema(queryInterface);
    await ensureEgresosCreditekEntradasPreSyncSchema(queryInterface);
    await sequelize.sync({});

    const tables = await queryInterface.showAllTables();
    await ensureControlFinancieroConciliacionManualCajaSchema(tables);

    await ensureCierreCajaSchema(queryInterface, tables);
    await ensureMovimientoCajaSchema(queryInterface, tables);
    await ensureDenominacionesCajaSchema(tables);
    await ensureMarketingSchema(queryInterface, tables);
    await ensureSistemasTareasSchema(queryInterface, tables);
    await ensureInventarioSistemasSchema(queryInterface, tables);
    await ensurePersonasSchema(queryInterface, tables);
    await ensureSecretariosEjecutivosPlanesSchema(queryInterface, tables);
    await ensurePlanesBatallaSchema(queryInterface, tables);
    await ensureConsejoEjecutivoSchema(tables);
    await ensureUsuariosSchema(queryInterface, tables);
    await ensureRolesPagoSchema(tables);
    await ensureComisionesConfiguracionSchema(queryInterface, tables);
    await ensurePagosComisionesSchema(queryInterface, tables);
    await ensureRolesCreditekResumenSchema(queryInterface, tables);
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
    const {
      seedMetaMinimaMultaConfiguracion,
    } = require("../seeders/metaMinimaMultaSeeder");
    await seedMetaMinimaMultaConfiguracion();
    const {
      seedReporteCajaUsuarioAgencia,
    } = require("../services/reporteCajaAgenciasService");
    await seedReporteCajaUsuarioAgencia();

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

    if (tables.includes("ventas")) {
      await addColumnIfMissing(queryInterface, "ventas", "comentarioAuditoria", {
        type: Sequelize.TEXT,
        allowNull: true,
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
        precioTarjetaCredito: {
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
        utilidadSobreCosto: {
          type: Sequelize.DECIMAL(10, 2),
          allowNull: true,
        },
        rentabilidad: {
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

      await sequelize.query(`
        UPDATE costo_historicos
        SET "precioTarjetaCredito" = "precioContado",
            "updatedAt" = NOW()
        WHERE "precioTarjetaCredito" IS NULL
          AND "precioContado" IS NOT NULL;
      `);
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

    if (tables.includes("usuarios") && tables.includes("usuarios_roles_pago")) {
      await sequelize.query(`
        INSERT INTO usuarios_roles_pago (
          usuario_id,
          rol_pago_id
        )
        SELECT
          id,
          "rolPagoId"
        FROM usuarios
        WHERE "rolPagoId" IS NOT NULL
        ON CONFLICT (usuario_id, rol_pago_id) DO NOTHING;
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
  ensureFacturasFisicasOcrPreSyncSchema,
};
