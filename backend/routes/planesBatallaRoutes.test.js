const express = require("express");
const request = require("supertest");

jest.mock("../models/PlanBatalla", () => ({
  create: jest.fn(),
  destroy: jest.fn(),
  findAll: jest.fn(),
  findByPk: jest.fn(),
  findOne: jest.fn(),
}));

jest.mock("../models/SecretarioEjecutivoPlan", () => ({
  destroy: jest.fn(),
  findAll: jest.fn(),
}));

jest.mock("../models/UsuarioAgencia", () => ({}));
jest.mock("../models/Usuario", () => ({}));
jest.mock("../models/Agencia", () => ({}));

jest.mock("../middleware/authMiddleware", () => ({
  authenticate: (req, _res, next) => {
    req.user = {
      usuarioAgenciaId: 27,
      permisos: String(req.headers["x-test-permisos"] || "")
        .split(",")
        .map((permiso) => permiso.trim())
        .filter(Boolean),
    };
    next();
  },
  requirePermission: () => (_req, _res, next) => next(),
}));

const PlanBatalla = require("../models/PlanBatalla");
const SecretarioEjecutivoPlan = require("../models/SecretarioEjecutivoPlan");
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

const crearPlanSecretario = (datos = {}) => ({
  get: () => ({
    id: 15,
    fecha: "2026-07-24",
    usuarioId: 8,
    agenciaId: 2,
    condicion: "emergencia",
    respuestasFormula: {
      1: [{ estado: "PENDIENTE", descripcion: "Preparar agenda" }],
    },
    detalle: {},
    prioridad: "ALTA",
    estado: "EN_PROGRESO",
    observaciones: "Plan de secretaria",
    createdAt: "2026-07-24T13:00:00.000Z",
    usuario: {
      id: 8,
      nombre: "Secretaria Prueba",
      email: "secretaria@empresa.com",
    },
    agencia: {
      id: 2,
      nombre: "Matriz",
    },
    ...datos,
  }),
});

describe("GET /api/planes-batalla", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("combina planes de vendedores y secretarios ejecutivos", async () => {
    PlanBatalla.findAll.mockResolvedValue([crearPlanSerializado()]);
    SecretarioEjecutivoPlan.findAll.mockResolvedValue([
      crearPlanSecretario(),
    ]);

    const response = await request(crearAplicacion())
      .get("/api/planes-batalla")
      .query({
        agenciaId: 2,
        vendedorId: 8,
        fechaInicio: "2026-07-24",
        fechaFin: "2026-07-24",
        condicion: "emergencia",
      });

    expect(response.status).toBe(200);
    expect(response.body.planes).toHaveLength(2);
    expect(response.body.planes[0]).toEqual(
      expect.objectContaining({
        id: 15,
        origen: "secretario_ejecutivo",
        puedeEliminar: true,
        usuario: expect.objectContaining({ nombre: "Secretaria Prueba" }),
        plan: expect.objectContaining({
          fechaInicio: "2026-07-24",
          observacion: "Plan de secretaria",
        }),
      }),
    );
    expect(response.body.planes[1]).toEqual(
      expect.objectContaining({
        id: 15,
        origen: "vendedor",
        puedeEliminar: true,
      }),
    );

    const consultaSecretarios = SecretarioEjecutivoPlan.findAll.mock.calls[0][0];
    expect(consultaSecretarios.where).toEqual(
      expect.objectContaining({
        agenciaId: 2,
        usuarioId: 8,
        condicion: "emergencia",
      }),
    );
  });
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

describe("DELETE /api/planes-batalla/:id", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("elimina un plan de secretario cuando el usuario tiene permiso de Gerencia", async () => {
    SecretarioEjecutivoPlan.destroy.mockResolvedValue(1);

    const response = await request(crearAplicacion())
      .delete("/api/planes-batalla/15")
      .query({ origen: "secretario_ejecutivo" })
      .set("x-test-permisos", "Gerencia");

    expect(response.status).toBe(200);
    expect(SecretarioEjecutivoPlan.destroy).toHaveBeenCalledWith({
      where: { id: "15" },
    });
    expect(PlanBatalla.destroy).not.toHaveBeenCalled();
  });

  test("impide eliminar un plan de secretario sin permiso de Gerencia", async () => {
    const response = await request(crearAplicacion())
      .delete("/api/planes-batalla/15")
      .query({ origen: "secretario_ejecutivo" });

    expect(response.status).toBe(403);
    expect(SecretarioEjecutivoPlan.destroy).not.toHaveBeenCalled();
  });

  test("mantiene la eliminacion de planes propios de vendedores", async () => {
    PlanBatalla.destroy.mockResolvedValue(1);

    const response = await request(crearAplicacion())
      .delete("/api/planes-batalla/15")
      .query({ origen: "vendedor" });

    expect(response.status).toBe(200);
    expect(PlanBatalla.destroy).toHaveBeenCalledWith({
      where: {
        id: "15",
        usuarioAgenciaId: 27,
      },
    });
    expect(SecretarioEjecutivoPlan.destroy).not.toHaveBeenCalled();
  });
});
