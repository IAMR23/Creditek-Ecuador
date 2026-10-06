// Prueba optativa: únicamente acepta una base efímera local con nombre de test.
// No usa .env ni connectDB(), ni ejecuta las migraciones de otros módulos.
const connection = process.env.RVE_COMBUSTIBLE_TEST_DATABASE_URL;
const suite = connection ? describe : describe.skip;

jest.mock("../config/db", () => {
  const { Sequelize } = require("sequelize");
  const url = new URL(process.env.RVE_COMBUSTIBLE_TEST_DATABASE_URL);
  if (
    !["127.0.0.1", "localhost"].includes(url.hostname) ||
    !/^\/rve_combustible_test(?:_[a-z0-9]+)?$/.test(url.pathname)
  ) {
    throw new Error(
      "La integración requiere una base local rve_combustible_test aislada.",
    );
  }
  return { sequelize: new Sequelize(url.href, { logging: false }) };
});
jest.mock("../models/Usuario", () => {
  const { DataTypes } = require("sequelize");
  const { sequelize } = require("../config/db");
  return sequelize.define(
    "Usuario",
    {
      id: { type: DataTypes.INTEGER, primaryKey: true },
      nombre: DataTypes.STRING,
      rolId: DataTypes.INTEGER,
    },
    { tableName: "usuarios", timestamps: false },
  );
});
jest.mock("../models/Rol", () => {
  const { DataTypes } = require("sequelize");
  const { sequelize } = require("../config/db");
  return sequelize.define(
    "Rol",
    {
      id: { type: DataTypes.INTEGER, primaryKey: true },
      nombre: DataTypes.STRING,
    },
    { tableName: "roles", timestamps: false },
  );
});

suite("combustible con PostgreSQL real aislado", () => {
  let sequelize, Registro, Usuario, servicio, sql, sqlVehiculo, sqlCatalogo;
  const admin = { id: 1, rol: "admin", permisos: ["Logistica"] };
  const repartidor = { id: 9, rol: "repartidor", permisos: [] };
  const data = {
    fecha: "2026-10-06",
    vehiculo: "MOTO ROJA",
    kilometrajeInicial: 100.1,
    kilometrajeFinal: 120.3,
    costoCombustible: 4.1,
  };

  beforeAll(async () => {
    sequelize = require("../config/db").sequelize;
    servicio = require("./logisticaCombustibleService");
    Registro = require("../models/LogisticaCombustibleRegistro");
    Usuario = require("../models/Usuario");
    const Rol = require("../models/Rol");
    Usuario.belongsTo(Rol, { as: "rol", foreignKey: "rolId" });
    Registro.belongsTo(Usuario, { as: "repartidor", foreignKey: "userId" });
    await Rol.sync();
    await Usuario.sync();
    sql = require("fs").readFileSync(
      require("path").join(
        __dirname,
        "../migrations/202610060001-create-logistica-combustible.sql",
      ),
      "utf8",
    );
    await sequelize.query(sql);
    await Rol.create({ id: 1, nombre: "REPARTIDOR" });
    await Usuario.bulkCreate([
      { id: 9, nombre: "Repartidor A", rolId: 1 },
      { id: 10, nombre: "Repartidor B", rolId: 1 },
    ]);
    // Simula una instalación anterior con consumo obligatorio y sin vehículo.
    await sequelize.query(`INSERT INTO logistica_combustible_registros
      ("userId", fecha, "kilometrajeInicial", "kilometrajeFinal", "kilometrosRecorridos", "combustibleConsumido", "costoCombustible")
      VALUES (9, '2026-10-01', 100, 120, 20, 2, 5)`);
    sqlVehiculo = require("fs").readFileSync(
      require("path").join(
        __dirname,
        "../migrations/202610060002-combustible-vehiculo-sin-consumo.sql",
      ),
      "utf8",
    );
    await sequelize.query(sqlVehiculo);
    sqlCatalogo = require("fs").readFileSync(
      require("path").join(
        __dirname,
        "../migrations/202610060003-combustible-catalogo-vehiculos.sql",
      ),
      "utf8",
    );
    await sequelize.query(sqlCatalogo);
    await sequelize.query(sql);
    await sequelize.query(sqlVehiculo); // Ambas migraciones siguen siendo repetibles.
    await sequelize.query(sqlCatalogo);
    const [historicos] = await sequelize.query(
      'SELECT vehiculo, "combustibleConsumido" FROM logistica_combustible_registros',
    );
    expect(historicos).toEqual([
      { vehiculo: null, combustibleConsumido: "2.00" },
    ]);
    await Registro.sync();
  });
  beforeEach(async () => {
    await sequelize.query("DELETE FROM logistica_combustible_registros");
  });
  afterAll(async () => {
    if (sequelize) await sequelize.close();
  });

  test("CRUD, consultas y estadísticas mantienen propiedad y baja lógica", async () => {
    const propio = await servicio.crear({ user: repartidor, data });
    await servicio.crear({
      user: { ...repartidor, id: 10 },
      data: { ...data, fecha: "2026-10-05", costoCombustible: 3.2 },
    });
    const lista = await servicio.listar({ user: admin, query: { limite: 1 } });
    expect(lista.registros).toHaveLength(1);
    expect(lista.paginacion.total).toBe(2);
    expect(lista.totales).toEqual({
      kilometrosRecorridos: 40.4,
      costoCombustible: 7.3,
    });
    expect(lista.registros[0].repartidor.nombre).toBe("Repartidor A");
    expect(lista.registros[0].vehiculo).toBe(data.vehiculo);
    expect(lista.registros[0].get()).not.toHaveProperty("combustibleConsumido");
    expect(
      (await Registro.findByPk(propio.id)).combustibleConsumido,
    ).toBeNull();
    const otros = await servicio.listar({ user: { ...repartidor, id: 10 } });
    expect(otros.registros).toHaveLength(1);
    await expect(
      servicio.obtener({ user: { ...repartidor, id: 10 }, id: propio.id }),
    ).rejects.toMatchObject({ status: 404 });
    await servicio.actualizar({
      user: repartidor,
      id: propio.id,
      data: { ...data, kilometrajeFinal: 125.1 },
    });
    const filtro = await servicio.listar({
      user: admin,
      query: {
        desde: "2026-10-06",
        hasta: "2026-10-06",
        kmMin: 24,
        kmMax: 26,
        userId: 9,
      },
    });
    expect(filtro.totales.kilometrosRecorridos).toBe(25);
    const catalogo = await servicio.repartidores({ user: admin });
    expect(catalogo.map((user) => user.id)).toEqual([9, 10]);
    await servicio.eliminar({ user: repartidor, id: propio.id });
    expect(await Registro.findByPk(propio.id)).toBeNull();
    expect(
      (await Registro.findByPk(propio.id, { paranoid: false })).deletedAt,
    ).toBeTruthy();
    expect((await servicio.listar({ user: admin })).paginacion.total).toBe(1);
  });

  test("restricción SQL rechaza inconsistencias aun fuera de la API", async () => {
    const propio = await servicio.crear({ user: repartidor, data });
    await expect(
      sequelize.query(
        'UPDATE logistica_combustible_registros SET "kilometrosRecorridos" = 999 WHERE id = :id',
        { replacements: { id: propio.id } },
      ),
    ).rejects.toMatchObject({ original: { code: "23514" } });
    await expect(
      sequelize.query(
        'UPDATE logistica_combustible_registros SET "costoCombustible" = -1 WHERE id = :id',
        { replacements: { id: propio.id } },
      ),
    ).rejects.toMatchObject({ original: { code: "23514" } });
    await expect(
      sequelize.query(
        "UPDATE logistica_combustible_registros SET vehiculo = 'MOTO VERDE' WHERE id = :id",
        { replacements: { id: propio.id } },
      ),
    ).rejects.toMatchObject({ original: { code: "23514" } });
  });

  test("migración conserva registros al repetirse y también funciona tras sync", async () => {
    const propio = await servicio.crear({ user: repartidor, data });
    await Registro.sync();
    await sequelize.query(sql);
    await sequelize.query(sqlVehiculo);
    await sequelize.query(sqlCatalogo);
    expect(await Registro.findByPk(propio.id)).not.toBeNull();
  });
});
