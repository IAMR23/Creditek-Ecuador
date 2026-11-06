const fs = require("fs");
const path = require("path");

describe("migracion de responsables comerciales predeterminados", () => {
  const sql = fs.readFileSync(
    path.join(
      __dirname,
      "202611060005-asignar-lideres-comerciales-desde-septiembre.sql",
    ),
    "utf8",
  );

  test("asigna Piso a Nicolas y Call Center a Damian desde septiembre", () => {
    expect(sql).toContain("DATE '2026-09-01'");
    expect(sql).toContain("%Nicolas%Llerena%");
    expect(sql).toContain("%Damian%Caiza%");
    expect(sql).toContain("WHEN e.equipo = 'PISO' THEN nicolas_id");
    expect(sql).toContain("WHEN e.equipo = 'CALL CENTER' THEN damian_id");
  });

  test("deja tramos abiertos y conserva lo anterior como historial", () => {
    expect(sql).toContain('"vigenciaHasta" = GREATEST');
    expect(sql).toContain("MIGRACION_REGLA_EQUIPO");
    expect(sql).toContain("migracion_asignaciones_comerciales_202609");
  });
});
