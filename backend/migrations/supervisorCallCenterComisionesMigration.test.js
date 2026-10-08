const fs = require("fs");
const path = require("path");

describe("migracion de comisiones de Supervisor de Call Center", () => {
  const sql = fs.readFileSync(
    path.join(
      __dirname,
      "202610080003-unificar-supervisor-call-center-6-vendedores.sql",
    ),
    "utf8",
  );

  test("conserva la matriz vinculada al rol y desactiva la matriz antigua", () => {
    expect(sql).toContain("SUPERVISOR DE CALL CENTER");
    expect(sql).toContain('"rolPagoId" = rol_supervisor.id');
    expect(sql).toContain("UPPER(TRIM(grupo)) = 'SUPERVISOR CALL CENTER'");
    expect(sql).toContain("activo = FALSE");
    expect(sql).not.toMatch(/DELETE\s+FROM/i);
  });

  test("incluye seis vendedores y limita el divisor entre uno y seis", () => {
    expect(sql).toContain("'6 vendedores'");
    expect(sql).toContain('"cantidadVendedoresComision" BETWEEN 1 AND 6');
    expect(sql).toContain("pagos_comisiones_equipos_cantidad_vendedores_check");
  });

  test("se ejecuta automaticamente al iniciar el backend", () => {
    const dbConfig = fs.readFileSync(
      path.join(__dirname, "../config/db.js"),
      "utf8",
    );

    expect(dbConfig).toContain(
      "202610080003-unificar-supervisor-call-center-6-vendedores.sql",
    );
    expect(dbConfig).toContain("ensureSupervisorCallCenterComisionesSchema");
  });

  test("el seeder no vuelve a activar la matriz antigua", () => {
    const seeder = fs.readFileSync(
      path.join(__dirname, "../seeders/comisionesConfiguracionSeeder.js"),
      "utf8",
    );

    expect(seeder).toContain(
      'registro.grupo !== "SUPERVISOR CALL CENTER"',
    );
    expect(seeder).toContain('{ activo: false }');
  });
});
