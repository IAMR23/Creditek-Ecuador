const express = require("express");
const request = require("supertest");

jest.mock("../middleware/authMiddleware", () => ({
  authenticate: (_req, _res, next) => next(),
  requirePermission: () => (_req, _res, next) => next(),
}));

jest.mock("../models/Usuario", () => ({
  findAll: jest.fn(),
}));

jest.mock("../services/absUsuariosService", () => ({
  consultarUsuarioAbsPorCedula: jest.fn(),
}));

const Usuario = require("../models/Usuario");
const {
  consultarUsuarioAbsPorCedula,
} = require("../services/absUsuariosService");
const usuariosAbsRoutes = require("./usuariosAbsRoutes");

const crearAplicacion = () => {
  const app = express();
  app.use(express.json());
  app.use("/api/usuarios-abs", usuariosAbsRoutes);
  return app;
};

describe("GET /api/usuarios-abs/por-cedula/:cedula", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Usuario.findAll.mockResolvedValue([]);
  });

  test("precarga el usuario encontrado en ABS", async () => {
    consultarUsuarioAbsPorCedula.mockResolvedValue({
      ok: true,
      encontrado: true,
      usuario: {
        cedula: "0102030405",
        nombre: "María Pérez",
        email: "maria@ejemplo.com",
      },
    });

    const response = await request(crearAplicacion()).get(
      "/api/usuarios-abs/por-cedula/0102030405",
    );

    expect(response.status).toBe(200);
    expect(response.body.usuario.cedula).toBe("0102030405");
    expect(consultarUsuarioAbsPorCedula).toHaveBeenCalledWith("0102030405");
  });

  test("no consulta ABS si la cedula ya existe en RVE", async () => {
    Usuario.findAll.mockResolvedValue([
      {
        id: 20,
        nombre: "María Pérez",
        cedula: "0102030405",
        email: "maria@ejemplo.com",
      },
    ]);

    const response = await request(crearAplicacion()).get(
      "/api/usuarios-abs/por-cedula/0102030405",
    );

    expect(response.status).toBe(409);
    expect(response.body.code).toBe("USUARIO_YA_EXISTE_RVE");
    expect(consultarUsuarioAbsPorCedula).not.toHaveBeenCalled();
  });

  test("conserva la respuesta cuando ABS no encuentra la cedula", async () => {
    consultarUsuarioAbsPorCedula.mockResolvedValue({
      ok: true,
      encontrado: false,
      cedula: "0102030405",
      usuario: null,
    });

    const response = await request(crearAplicacion()).get(
      "/api/usuarios-abs/por-cedula/0102030405",
    );

    expect(response.status).toBe(200);
    expect(response.body.encontrado).toBe(false);
  });
});
