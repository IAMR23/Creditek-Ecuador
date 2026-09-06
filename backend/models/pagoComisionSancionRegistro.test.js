const { sequelize } = require("../config/db");

// El arranque carga associations antes de connectDB y antes de las rutas.
require("./associations");

test("registra observaciones de sanciones antes de sincronizar la base", () => {
  const model = sequelize.models.PagoComisionSancionObservacion;
  expect(model).toBeDefined();
  expect(model.getTableName()).toBe("pagos_comisiones_sanciones_observaciones");
  expect(model.associations.actualizadoPor.target).toBe(sequelize.models.Usuario);
  expect(model.options.indexes).toEqual(expect.arrayContaining([
    expect.objectContaining({ unique: true, fields: ["anio", "mes"] }),
  ]));
});
