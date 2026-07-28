const express = require("express");
const request = require("supertest");

jest.mock("../middleware/authMiddleware", () => ({
  authenticate: (req, _res, next) => {
    req.user = { id: 7 };
    next();
  },
  requirePermission: () => (_req, _res, next) => next(),
}));

jest.mock("../models/Usuario", () => ({
  findAll: jest.fn().mockResolvedValue([]),
}));

jest.mock("../models/NotificacionPersonal", () => ({
  count: jest.fn(),
  findAll: jest.fn(),
  findByPk: jest.fn(),
}));

jest.mock("../models/NotificacionPersonalLectura", () => ({
  bulkCreate: jest.fn(),
  count: jest.fn(),
  findAll: jest.fn(),
  findOrCreate: jest.fn(),
}));

jest.mock("../services/alertasPersonalService", () => ({
  construirAlertasPersonal: jest.fn().mockReturnValue([]),
  obtenerFechaActualEcuador: jest.fn().mockReturnValue("2026-07-28"),
  obtenerRangoDiaEcuador: jest.fn().mockReturnValue({
    inicio: new Date("2026-07-28T05:00:00.000Z"),
    fin: new Date("2026-07-29T05:00:00.000Z"),
  }),
  sumarDiasFecha: jest.fn().mockReturnValue("2026-07-13"),
}));

jest.mock("../services/notificacionesPersonalService", () => ({
  registrarAlertasPersonal: jest.fn().mockResolvedValue([]),
}));

const NotificacionPersonal = require("../models/NotificacionPersonal");
const NotificacionPersonalLectura = require("../models/NotificacionPersonalLectura");
const alertasPersonalRoutes = require("./alertasPersonalRoutes");

const crearAplicacion = () => {
  const app = express();
  app.use(express.json());
  app.use("/api/alertas-personal", alertasPersonalRoutes);
  return app;
};

describe("alertas personales persistentes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("lista el historial con lectura independiente para el usuario autenticado", async () => {
    const creadaAt = new Date("2026-07-28T15:00:00.000Z");
    NotificacionPersonal.count.mockResolvedValue(2);
    NotificacionPersonal.findAll.mockResolvedValue([
      {
        id: 2,
        tipo: "FECHA_SALIDA",
        titulo: "Salida",
        mensaje: "Salida registrada",
        usuarioReferenciaId: 15,
        nombreReferencia: "Usuario",
        fechaReferencia: "2026-08-01",
        fechaEvento: "2026-07-28",
        prioridad: "warning",
        origen: "ABS",
        createdAt: creadaAt,
      },
    ]);
    NotificacionPersonalLectura.count.mockResolvedValue(1);
    NotificacionPersonalLectura.findAll.mockResolvedValue([
      { notificacionId: 2, leidaAt: creadaAt },
    ]);

    const response = await request(crearAplicacion()).get(
      "/api/alertas-personal",
    );

    expect(response.status).toBe(200);
    expect(response.body.total).toBe(2);
    expect(response.body.noLeidas).toBe(1);
    expect(response.body.alertas[0]).toEqual(
      expect.objectContaining({
        id: 2,
        leida: true,
        origen: "ABS",
      }),
    );
  });

  test("permite marcar una notificación como leída", async () => {
    const lectura = {
      leidaAt: null,
      save: jest.fn().mockResolvedValue(undefined),
    };
    NotificacionPersonal.findByPk.mockResolvedValue({ id: 2 });
    NotificacionPersonalLectura.findOrCreate.mockResolvedValue([
      lectura,
      false,
    ]);

    const response = await request(crearAplicacion())
      .patch("/api/alertas-personal/2/lectura")
      .send({ leida: true });

    expect(response.status).toBe(200);
    expect(response.body.leida).toBe(true);
    expect(lectura.leidaAt).toEqual(expect.any(Date));
    expect(lectura.save).toHaveBeenCalled();
  });

  test("marca todo el historial como leído sin eliminar eventos", async () => {
    NotificacionPersonal.findAll.mockResolvedValue([{ id: 1 }, { id: 2 }]);
    NotificacionPersonalLectura.bulkCreate.mockResolvedValue([]);

    const response = await request(crearAplicacion()).patch(
      "/api/alertas-personal/leidas/todas",
    );

    expect(response.status).toBe(200);
    expect(response.body.noLeidas).toBe(0);
    expect(NotificacionPersonalLectura.bulkCreate).toHaveBeenCalledWith(
      [
        expect.objectContaining({ notificacionId: 1, usuarioId: 7 }),
        expect.objectContaining({ notificacionId: 2, usuarioId: 7 }),
      ],
      expect.objectContaining({
        updateOnDuplicate: ["leidaAt", "updatedAt"],
      }),
    );
  });
});
