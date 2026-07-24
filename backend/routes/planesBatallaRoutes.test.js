const express = require("express");
const request = require("supertest");

jest.mock("../models/PlanBatalla", () => ({
  create: jest.fn(),
  destroy: jest.fn(),
  findAll: jest.fn(),
  findByPk: jest.fn(),
  findOne: jest.fn(),
}));

jest.mock("../models/UsuarioAgencia", () => ({}));
jest.mock("../models/Usuario", () => ({}));
jest.mock("../models/Agencia", () => ({}));

jest.mock("../middleware/authMiddleware", () => ({
  authenticate: (req, _res, next) => {
    req.user = {
      usuarioAgenciaId: 27,
      permisos: [],
    };
    next();
  },
  requirePermission: () => (_req, _res, next) => next(),
}));

const PlanBatalla = require("../models/PlanBatalla");
const planesBatallaRoutes = require("./planesBatallaRoutes");

const crearAplicacion = () => {
  const app = express();
  app.use(express.json());
  app.use("/api/planes-batalla", planesBatallaRoutes);
  return app;
};

const payload = {
  condicion: "inexistencia_extendida",
  fechaInicio: "2026-07-24",
  fechaFin: null,
  respuestasFormula: {
    1: [{ estado: "PENDIENTE", descripcion: "Contactar al equipo" }],
  },
  detalle: {
    "Actividades urgentes": [
      { estado: "En progreso", descripcion: "Actualizar cartera" },
    ],
  },
  observacion: "Plan actualizado",
};

const crearPlanSerializado = (datos = {}) => ({
  get: () => ({
    id: 15,
    createdAt: "2026-07-24T12:00:00.000Z",
    usuarioAgenciaId: 27,
    ...payload,
    usuarioAgencia: {
      usuario: {
        id: 4,
        nombre: "Vendedor Prueba",
        email: "vendedor@empresa.com",
      },
      agencia: {
        id: 2,
        nombre: "Matriz",
      },
    },
    ...datos,
  }),
});

describe("POST /api/planes-batalla", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("devuelve el plan existente cuando se repite la clave de envio", async () => {
    PlanBatalla.findOne.mockResolvedValue(
      crearPlanSerializado({ claveIdempotencia: "envio-repetido-123" }),
    );

    const response = await request(crearAplicacion())
      .post("/api/planes-batalla")
      .send({
        ...payload,
        claveIdempotencia: "envio-repetido-123",
      });

    expect(response.status).toBe(200);
    expect(response.body.deduplicado).toBe(true);
    expect(PlanBatalla.create).not.toHaveBeenCalled();
  });

  test("resuelve una carrera concurrente sin duplicar la respuesta", async () => {
    PlanBatalla.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(
        crearPlanSerializado({ claveIdempotencia: "envio-concurrente-123" }),
      );
    PlanBatalla.create.mockRejectedValue({
      name: "SequelizeUniqueConstraintError",
    });

    const response = await request(crearAplicacion())
      .post("/api/planes-batalla")
      .send({
        ...payload,
        claveIdempotencia: "envio-concurrente-123",
      });

    expect(response.status).toBe(200);
    expect(response.body.deduplicado).toBe(true);
    expect(PlanBatalla.create).toHaveBeenCalledTimes(1);
  });
});

describe("PUT /api/planes-batalla/:id", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("actualiza solamente un plan perteneciente al vendedor autenticado", async () => {
    const registro = {
      id: 15,
      update: jest.fn().mockResolvedValue(undefined),
    };

    PlanBatalla.findOne.mockResolvedValue(registro);
    PlanBatalla.findByPk.mockResolvedValue(crearPlanSerializado());

    const response = await request(crearAplicacion())
      .put("/api/planes-batalla/15")
      .send(payload);

    expect(response.status).toBe(200);
    expect(PlanBatalla.findOne).toHaveBeenCalledWith({
      where: {
        id: "15",
        usuarioAgenciaId: 27,
      },
    });
    expect(registro.update).toHaveBeenCalledWith(payload);
    expect(response.body.plan).toEqual(
      expect.objectContaining({
        id: 15,
        plan: expect.objectContaining({
          condicion: "inexistencia_extendida",
          detalle: payload.detalle,
        }),
      }),
    );
  });

  test("responde 404 cuando el plan no pertenece al vendedor", async () => {
    PlanBatalla.findOne.mockResolvedValue(null);

    const response = await request(crearAplicacion())
      .put("/api/planes-batalla/99")
      .send(payload);

    expect(response.status).toBe(404);
    expect(response.body.message).toBe("Plan no encontrado");
    expect(PlanBatalla.findByPk).not.toHaveBeenCalled();
  });
});
