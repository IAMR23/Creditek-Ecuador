const fs = require("fs");
const path = require("path");

describe("migracion de configuracion GHL en tiempo real", () => {
  const sql = fs.readFileSync(
    path.join(__dirname, "202609210001-create-ghl-reparto-tiempo-real-configuracion.sql"),
    "utf8",
  );

  test("es incremental, singleton y deja un respaldo inactivo", () => {
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS ghl_reparto_tiempo_real_configuraciones");
    expect(sql).toContain("CHECK (id = 1)");
    expect(sql).toContain('"horaPausaAutomatica" VARCHAR(5) NOT NULL DEFAULT \'18:00\'');
    expect(sql).toContain("ON CONFLICT (id) DO NOTHING");
    expect(sql).toContain("2, FALSE");
    expect(sql).not.toMatch(/DROP\s+TABLE/i);
  });

  test("conserva IDs historicos compatibles sin convertir nombres en fuente de verdad", () => {
    expect(sql).toContain('ARRAY_AGG("stageId"');
    expect(sql).toContain('ARRAY_AGG("stageNombre"');
    expect(sql).toContain("modo = 'unassigned'");
  });
});

describe("migracion incremental de pausa automatica", () => {
  const sql = fs.readFileSync(
    path.join(__dirname, "202609210002-add-ghl-advisor-auto-pause-time.sql"),
    "utf8",
  );

  test("agrega una hora valida sin eliminar configuraciones existentes", () => {
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS "horaPausaAutomatica"');
    expect(sql).toContain("SET \"horaPausaAutomatica\" = '18:00'");
    expect(sql).toContain("ghl_reparto_tiempo_real_hora_pausa_check");
    expect(sql).not.toMatch(/DROP\s+TABLE/i);
  });
});

describe("migracion incremental de inicio de Play", () => {
  const sql = fs.readFileSync(
    path.join(__dirname, "202609230001-add-ghl-advisor-play-start-time.sql"),
    "utf8",
  );

  test("agrega una hora valida sin modificar la seleccion del reparto", () => {
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS "horaInicioPlay"');
    expect(sql).toContain('SET "horaInicioPlay" = \'00:00\'');
    expect(sql).toContain("ghl_reparto_tiempo_real_hora_inicio_play_check");
    expect(sql).not.toMatch(/DROP\s+TABLE/i);
  });
});
