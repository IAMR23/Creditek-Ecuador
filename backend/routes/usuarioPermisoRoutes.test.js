const express = require("express");
const request = require("supertest");

jest.mock("../middleware/authMiddleware", () => ({
  authenticate: (req, _res, next) => {
    req.user = { id: 1, permisos: ["Administracion"] };
    next();
  },
  requirePermission: () => (_req, _res, next) => next(),
}));
jest.mock("../models/UsuarioPermiso", () => ({
  destroy: jest.fn().mockResolvedValue(1),
  bulkCreate: jest.fn().mockResolvedValue([]),
  findAll: jest.fn().mockResolvedValue([]),
}));
jest.mock("../models/UsuarioAgencia", () => ({ findAll: jest.fn() }));
jest.mock("../models/Permiso", () => ({
  findAll: jest.fn().mockResolvedValue([{ id: 3 }]),
}));
jest.mock("../models/Usuario", () => ({
  findByPk: jest.fn().mockResolvedValue({ id: 9, nombre: "Usuario" }),
  findAll: jest.fn(),
}));
jest.mock("../models/Agencia", () => ({}));
jest.mock("../models/Rol", () => ({}));

const UsuarioPermiso = require("../models/UsuarioPermiso");
const routes = require("./usuarioPermisoRoutes");

describe("actualizacion de permisos en tiempo real", () => {
  test("notifica solo a la sala del usuario afectado despues de guardar", async () => {
    const emit = jest.fn();
    const to = jest.fn(() => ({ emit }));
    const app = express();
    app.set("io", { to });
    app.use(express.json());
    app.use("/api/usuario-permisos", routes);

    await request(app)
      .post("/api/usuario-permisos")
      .send({ usuarioId: 9, permisoIds: [3] })
      .expect(200);

    expect(UsuarioPermiso.destroy).toHaveBeenCalledWith({ where: { usuarioId: 9 } });
    expect(to).toHaveBeenCalledWith("user_9");
    expect(emit).toHaveBeenCalledWith(
      "permisos-actualizados",
      expect.objectContaining({ actualizadoAt: expect.any(String) }),
    );
  });
});
