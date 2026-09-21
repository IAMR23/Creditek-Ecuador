const service = require("./ghlWorkflowConfigurationService");

describe("configuracion de workflows programados", () => {
  test("calcula fecha, hora y dia en America/Guayaquil", () => {
    expect(service.localParts(new Date("2026-09-21T15:00:00.000Z"))).toEqual({
      date: "2026-09-21",
      time: "10:00",
      day: 1,
    });
  });

  test("calcula la siguiente ejecucion respetando dias y hora", () => {
    const row = { hora: "10:00", diasSemana: [1, 3] };
    expect(service.nextRun(row, new Date("2026-09-21T14:59:00.000Z"))).toBe("2026-09-21T10:00:00-05:00");
    expect(service.nextRun(row, new Date("2026-09-21T15:01:00.000Z"))).toBe("2026-09-23T10:00:00-05:00");
  });

  test("sanitiza secretos y datos personales en mensajes", () => {
    const output = service.sanitize("Authorization: Bearer abc.def email=test@example.com phone=+593999999999");
    expect(output).not.toContain("abc.def");
    expect(output).not.toContain("test@example.com");
    expect(output).not.toContain("999999999");
  });
});
