const express = require("express");
const request = require("supertest");
const { Op } = require("sequelize");

jest.mock("bcryptjs", () => ({
  compare: jest.fn(),
}));

jest.mock("jsonwebtoken", () => ({
  sign: jest.fn((payload) =>
    payload.type === "refresh" ? "refresh-token" : "access-token",
  ),
  verify: jest.fn(),
}));

jest.mock("../models/Usuario", () => ({
  findOne: jest.fn(),
}));

jest.mock("../models/UsuarioAgencia", () => ({
  findAll: jest.fn(),
}));

jest.mock("../models/Agencia", () => ({}));
jest.mock("../models/Rol", () => ({}));

jest.mock("../models/UsuarioPermiso", () => ({
  findAll: jest.fn(),
}));

jest.mock("../models/Permiso", () => ({}));

const bcrypt = require("bcryptjs");
const Usuario = require("../models/Usuario");
const UsuarioAgencia = require("../models/UsuarioAgencia");
const UsuarioPermiso = require("../models/UsuarioPermiso");
const authRoutes = require("./authRoutes");

const crearAplicacion = () => {
  const app = express();
  app.use(express.json());
  app.use("/auth", authRoutes);
  return app;
};

const usuarioActivo = {
  id: 7,
  nombre: "Usuario Prueba",
  email: "usuario.prueba@empresa.com",
  usuario: "usuario.prueba",
  password: "hash",
  activo: true,
  rol: { id: 2, nombre: "Vendedor", descripcion: "Ventas" },
  roles: [{ id: 2, nombre: "Vendedor", descripcion: "Ventas" }],
};

describe("POST /auth/login", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Usuario.findOne.mockResolvedValue(usuarioActivo);
    UsuarioAgencia.findAll.mockResolvedValue([
      {
        id: 11,
        rolAgencia: null,
        agencia: {
          id: 3,
          nombre: "Matriz",
          direccion: "Direccion",
          telefono: "000",
          ciudad: "Quito",
        },
      },
    ]);
    UsuarioPermiso.findAll.mockResolvedValue([]);
    bcrypt.compare.mockResolvedValue(true);
  });

  test("permite ingresar con nombre de usuario", async () => {
    const response = await request(crearAplicacion()).post("/auth/login").send({
      identificador: "  USUARIO.PRUEBA  ",
      password: "Clave123",
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual(
      expect.objectContaining({
        accessToken: "access-token",
        user: expect.objectContaining({ email: "usuario.prueba@empresa.com" }),
      }),
    );

    const condicionBusqueda = Usuario.findOne.mock.calls[0][0].where;
    expect(condicionBusqueda[Op.or]).toHaveLength(2);
  });

  test("mantiene compatible el ingreso con el campo email", async () => {
    const response = await request(crearAplicacion()).post("/auth/login").send({
      email: "usuario.prueba@empresa.com",
      password: "Clave123",
    });

    expect(response.status).toBe(200);
    expect(bcrypt.compare).toHaveBeenCalledWith("Clave123", "hash");
  });

  test("rechaza solicitudes sin correo ni usuario", async () => {
    const response = await request(crearAplicacion()).post("/auth/login").send({
      password: "Clave123",
    });

    expect(response.status).toBe(400);
    expect(Usuario.findOne).not.toHaveBeenCalled();
  });
});
