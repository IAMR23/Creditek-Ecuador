jest.mock("../models/NotificacionPersonal", () => ({
  findOrCreate: jest.fn(),
}));

const NotificacionPersonal = require("../models/NotificacionPersonal");
const {
  registrarNotificacionDesdeAlerta,
  registrarNotificacionSalida,
  registrarNotificacionUsuarioCreado,
} = require("./notificacionesPersonalService");

describe("notificacionesPersonalService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    NotificacionPersonal.findOrCreate.mockResolvedValue([{ id: 1 }, true]);
  });

  test("registra altas con una clave idempotente", async () => {
    await registrarNotificacionUsuarioCreado({
      id: 25,
      nombre: "Ana Pérez",
      createdAt: new Date("2026-07-28T15:00:00.000Z"),
    });

    expect(NotificacionPersonal.findOrCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { claveEvento: "USUARIO_CREADO-25-2026-07-28" },
        defaults: expect.objectContaining({
          tipo: "USUARIO_CREADO",
          usuarioReferenciaId: 25,
          fechaEvento: "2026-07-28",
        }),
      }),
    );
  });

  test("registra una sola salida por usuario y fecha de salida", async () => {
    const usuario = {
      id: 30,
      nombre: "Luis Torres",
      fechaSalida: "2026-08-15",
      fechaSalidaRegistradaAt: new Date("2026-07-28T16:00:00.000Z"),
    };

    await registrarNotificacionSalida(usuario, { origen: "ABS" });
    await registrarNotificacionSalida(usuario, { origen: "ABS" });

    expect(NotificacionPersonal.findOrCreate).toHaveBeenCalledTimes(2);
    expect(NotificacionPersonal.findOrCreate).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: { claveEvento: "FECHA_SALIDA-30-2026-08-15" },
        defaults: expect.objectContaining({
          fechaReferencia: "2026-08-15",
          fechaEvento: "2026-07-28",
          origen: "ABS",
        }),
      }),
    );
  });

  test("materializa la alerta diaria de salida con la misma clave estable", async () => {
    await registrarNotificacionDesdeAlerta({
      id: "FECHA_SALIDA-30-2026-07-28",
      tipo: "FECHA_SALIDA",
      titulo: "Salida de usuario registrada",
      mensaje: "Se registró la salida de Luis Torres.",
      usuarioId: 30,
      nombre: "Luis Torres",
      fechaReferencia: "2026-08-15",
      fechaEvento: "2026-07-28",
      prioridad: "warning",
    });

    expect(NotificacionPersonal.findOrCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { claveEvento: "FECHA_SALIDA-30-2026-08-15" },
      }),
    );
  });
});
