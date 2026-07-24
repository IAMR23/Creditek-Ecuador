const express = require("express");
const request = require("supertest");

jest.mock("bcryptjs", () => ({
  hash: jest.fn().mockResolvedValue("password-hash"),
}));

jest.mock("../models/Usuario", () => ({
  create: jest.fn(),
  findAll: jest.fn(),
  findByPk: jest.fn(),
  findOne: jest.fn(),
}));

jest.mock("../models/Rol", () => ({
  findAll: jest.fn(),
}));

jest.mock("../models/UsuarioAgencia", () => ({
  update: jest.fn(),
}));

jest.mock("../models/UsuarioRol", () => ({
  bulkCreate: jest.fn(),
  destroy: jest.fn(),
}));

jest.mock("../models/RolPago", () => ({
  findOne: jest.fn(),
}));

jest.mock("../models/NominaEmpleado", () => ({
  update: jest.fn(),
}));

const Usuario = require("../models/Usuario");
const Rol = require("../models/Rol");
const usuarioRoutes = require("./UsuarioRoutes");

const crearAplicacion = () => {
  const app = express();
  app.use(express.json());
  app.use("/usuarios", usuarioRoutes);
  return app;
};

const payloadValido = {
  nombre: "Usuario Prueba",
  cedula: "0102030405",
  email: "usuario.prueba@empresa.com",
  usuario: "usuario.prueba",
  password: "clave123",
  rolIds: [2],
};

describe("POST /usuarios", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Usuario.findOne.mockResolvedValue(null);
    Rol.findAll.mockResolvedValue([{ id: 2 }]);
  });

  test("responde 400 y detalla los campos obligatorios faltantes", async () => {
    const response = await request(crearAplicacion())
      .post("/usuarios")
      .send({
        usuario: "usuario.prueba",
        password: "clave123",
        rolIds: [2],
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Complete los campos obligatorios.");
    expect(response.body.details).toContain(
      "Correo electrónico es obligatorio.",
    );
    expect(Usuario.create).not.toHaveBeenCalled();
  });

  test("convierte los errores de validacion de Sequelize en una respuesta util", async () => {
    Usuario.create.mockRejectedValue({
      name: "SequelizeValidationError",
      errors: [
        {
          path: "email",
          type: "Validation error",
          validatorKey: "isEmail",
          message: "Validation isEmail on email failed",
        },
      ],
    });

    const response = await request(crearAplicacion())
      .post("/usuarios")
      .send({
        ...payloadValido,
        email: "correo-invalido",
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Revise los datos ingresados.");
    expect(response.body.details).toContain(
      "Correo electrónico debe tener un formato válido.",
    );
  });

  test("incluye un detalle seguro cuando ocurre un error interno", async () => {
    Usuario.findOne.mockRejectedValue(new Error("Conexión no disponible"));

    const response = await request(crearAplicacion())
      .post("/usuarios")
      .send(payloadValido);

    expect(response.status).toBe(500);
    expect(response.body.message).toBe("Error al crear el usuario.");
    expect(response.body.detail).toBe("Conexión no disponible");
  });

  test("marca la salida y emite la novedad cuando se crea con fecha de salida", async () => {
    const io = { emit: jest.fn() };
    Usuario.create.mockImplementation(async (data) => ({
      id: 10,
      ...data,
      toJSON: () => ({ id: 10, ...data }),
    }));
    const app = crearAplicacion();
    app.set("io", io);

    const response = await request(app)
      .post("/usuarios")
      .send({
        ...payloadValido,
        fechaSalida: "2026-08-15",
      });

    expect(response.status).toBe(201);
    expect(Usuario.create).toHaveBeenCalledWith(
      expect.objectContaining({
        fechaSalida: "2026-08-15",
        fechaSalidaRegistradaAt: expect.any(Date),
      }),
    );
    expect(io.emit).toHaveBeenCalledWith(
      "novedades-personal:actualizar",
    );
  });
});

describe("PUT /usuarios/:id", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("marca y notifica la transicion de fecha de salida vacia a llena", async () => {
    const io = { emit: jest.fn() };
    const usuario = {
      id: 20,
      nombre: "Usuario Editado",
      fechaSalida: null,
      fechaSalidaRegistradaAt: null,
      save: jest.fn().mockResolvedValue(undefined),
      toJSON() {
        return {
          id: this.id,
          nombre: this.nombre,
          fechaSalida: this.fechaSalida,
          fechaSalidaRegistradaAt: this.fechaSalidaRegistradaAt,
        };
      },
    };
    Usuario.findByPk.mockResolvedValue(usuario);
    const app = crearAplicacion();
    app.set("io", io);

    const response = await request(app)
      .put("/usuarios/20")
      .send({ fechaSalida: "2026-09-01" });

    expect(response.status).toBe(200);
    expect(usuario.fechaSalida).toBe("2026-09-01");
    expect(usuario.fechaSalidaRegistradaAt).toEqual(expect.any(Date));
    expect(usuario.save).toHaveBeenCalled();
    expect(io.emit).toHaveBeenCalledWith(
      "novedades-personal:actualizar",
    );
  });
});
