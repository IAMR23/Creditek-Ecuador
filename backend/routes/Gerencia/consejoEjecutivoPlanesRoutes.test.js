const express = require("express");
const request = require("supertest");

jest.mock("../../services/consejoEjecutivoPlanesService", () => ({
  listarPlanes: jest.fn(),
  listarResponsables: jest.fn(),
  crearPlan: jest.fn(),
  actualizarPlan: jest.fn(),
}));

jest.mock("../../services/consejoEjecutivoSalasService", () => ({
  listarSalas: jest.fn(),
  crearSala: jest.fn(),
  actualizarSala: jest.fn(),
  obtenerDestinatarioIds: jest.fn().mockResolvedValue([7, 4]),
}));

jest.mock("../../middleware/authMiddleware", () => ({
  authenticate: (req, _res, next) => {
    req.user = { id: 7, permisos: ["Gerencia"] };
    next();
  },
  requirePermission: () => (_req, _res, next) => next(),
}));

const service = require("../../services/consejoEjecutivoPlanesService");
const salasService = require("../../services/consejoEjecutivoSalasService");
const routes = require("./consejoEjecutivoPlanesRoutes");

const crearAplicacion = () => {
  const emit = jest.fn();
  const to = jest.fn(() => ({ emit }));
  const app = express();
  app.use(express.json());
  app.set("io", { to });
  app.use("/api/gerencia/consejo-ejecutivo/planes", routes);
  return { app, emit, to };
};

const plan = {
  id: 12,
  salaId: 5,
  fecha: "2026-08-13",
  condicion: "normal",
  revision: 1,
  respuestasFormula: {},
  detalle: {},
};

describe("rutas del Consejo Ejecutivo", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("lista responsables Admin", async () => {
    service.listarResponsables.mockResolvedValue([
      { id: 3, nombre: "Admin Matriz", email: "admin@creditek.ec" },
    ]);
    const { app } = crearAplicacion();

    const response = await request(app).get(
      "/api/gerencia/consejo-ejecutivo/planes/responsables",
    );

    expect(response.status).toBe(200);
    expect(response.body.responsables).toHaveLength(1);
  });

  test("crea una sala con invitados y les notifica en tiempo real", async () => {
    const sala = {
      id: 5,
      nombre: "Consejo semanal",
      participantes: [{ id: 4, nombre: "Admin Matriz" }],
    };
    salasService.crearSala.mockResolvedValue(sala);
    const { app, emit, to } = crearAplicacion();

    const response = await request(app)
      .post("/api/gerencia/consejo-ejecutivo/planes/salas")
      .send({ nombre: "Consejo semanal", participanteIds: [4] });

    expect(response.status).toBe(201);
    expect(salasService.crearSala).toHaveBeenCalledWith({
      user: expect.objectContaining({ id: 7 }),
      data: expect.objectContaining({ participanteIds: [4] }),
    });
    expect(to).toHaveBeenCalledWith(["user_7", "user_4"]);
    expect(emit).toHaveBeenCalledWith(
      "consejo-ejecutivo:salas-actualizadas",
      { accion: "creada", sala },
    );
  });

  test("crea un plan y notifica solamente a los usuarios de la sala", async () => {
    service.crearPlan.mockResolvedValue(plan);
    const { app, emit, to } = crearAplicacion();

    const response = await request(app)
      .post("/api/gerencia/consejo-ejecutivo/planes")
      .send({ fecha: "2026-08-13", condicion: "normal" });

    expect(response.status).toBe(201);
    expect(service.crearPlan).toHaveBeenCalledWith({
      user: expect.objectContaining({ id: 7 }),
      data: expect.objectContaining({ condicion: "normal" }),
    });
    expect(to).toHaveBeenCalledWith(["user_7", "user_4"]);
    expect(emit).toHaveBeenCalledWith("consejo-ejecutivo:actualizado", {
      accion: "creado",
      plan,
    });
  });

  test("propaga el conflicto de revision al actualizar", async () => {
    const error = new Error("El plan fue actualizado por otra persona");
    error.statusCode = 409;
    service.actualizarPlan.mockRejectedValue(error);
    const { app, emit } = crearAplicacion();

    const response = await request(app)
      .put("/api/gerencia/consejo-ejecutivo/planes/12")
      .send({ ...plan, revision: 1 });

    expect(response.status).toBe(409);
    expect(response.body.message).toMatch(/actualizado por otra persona/i);
    expect(emit).not.toHaveBeenCalled();
  });
});
