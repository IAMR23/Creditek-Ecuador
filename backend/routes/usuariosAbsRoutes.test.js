const express = require("express");
const request = require("supertest");

jest.mock("../middleware/authMiddleware", () => ({
  authenticate: (_req, _res, next) => next(),
  requirePermission: () => (_req, _res, next) => next(),
}));

jest.mock("../config/db", () => ({
  sequelize: {
    transaction: jest.fn(async (callback) =>
      callback({ id: "transaction" }),
    ),
  },
}));

jest.mock("../models/Usuario", () => ({
  findAll: jest.fn(),
}));

jest.mock("../services/absUsuariosService", () => ({
  consultarUsuarioAbsPorCedula: jest.fn(),
}));

jest.mock("../services/notificacionesPersonalService", () => ({
  registrarNotificacionSalida: jest.fn().mockResolvedValue({ id: 1 }),
  registrarNotificacionSegura: jest.fn(async (promesa) => promesa),
}));

const Usuario = require("../models/Usuario");
const { sequelize } = require("../config/db");
const {
  consultarUsuarioAbsPorCedula,
} = require("../services/absUsuariosService");
const usuariosAbsRoutes = require("./usuariosAbsRoutes");

const crearAplicacion = () => {
  const app = express();
  app.set("io", { emit: jest.fn() });
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

  test("reconoce como vinculados los usuarios existentes en ambos sistemas", async () => {
    const usuarioRve = {
      id: 20,
      nombre: "María Pérez",
      cedula: "0102030405",
      email: "rve@ejemplo.com",
      usuario: "maria.rve",
      activo: true,
    };
    Usuario.findAll.mockResolvedValue([usuarioRve]);
    consultarUsuarioAbsPorCedula.mockResolvedValue({
      ok: true,
      encontrado: true,
      usuario: {
        cedula: "0102030405",
        nombre: "María Pérez",
        email: "abs@ejemplo.com",
      },
    });

    const response = await request(crearAplicacion()).get(
      "/api/usuarios-abs/por-cedula/0102030405",
    );

    expect(response.status).toBe(200);
    expect(response.body.existeEnRve).toBe(true);
    expect(response.body.vinculadoPorCedula).toBe(true);
    expect(response.body.usuarioRve.id).toBe(20);
    expect(response.body.usuarioAbs.email).toBe("abs@ejemplo.com");
    expect(consultarUsuarioAbsPorCedula).toHaveBeenCalledWith("0102030405");
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

  test("actualiza datos personales y preserva el acceso propio de RVE", async () => {
    const fechaRegistroAnterior = new Date("2026-07-01T14:00:00.000Z");
    const usuarioRve = {
      id: 20,
      nombre: "Nombre anterior",
      cedula: "0102030405",
      email: "rve@ejemplo.com",
      usuario: "usuario.rve",
      password: "hash-rve",
      rolId: 4,
      rolPagoId: 7,
      fechaIngreso: "2026-01-01",
      fechaSalida: null,
      fechaSalidaRegistradaAt: fechaRegistroAnterior,
      numeroCuenta: null,
      direccion: "Dirección anterior",
      telefono: null,
      activo: true,
      save: jest.fn().mockResolvedValue(undefined),
    };
    Usuario.findAll.mockResolvedValue([usuarioRve]);
    consultarUsuarioAbsPorCedula.mockResolvedValue({
      ok: true,
      encontrado: true,
      usuario: {
        cedula: "0102030405",
        nombre: "Nombre ABS",
        email: "abs@ejemplo.com",
        usuario: "usuario.abs",
        fechaIngreso: "2026-02-01",
        fechaSalida: "2026-07-28",
        numeroCuenta: "123456",
        direccion: "Dirección ABS",
        telefono: "0999999999",
      },
    });

    const app = crearAplicacion();
    const io = app.get("io");
    const response = await request(app)
      .patch("/api/usuarios-abs/por-cedula/0102030405")
      .send({});

    expect(response.status).toBe(200);
    expect(response.body.actualizado).toBe(true);
    expect(usuarioRve.nombre).toBe("Nombre ABS");
    expect(usuarioRve.fechaSalida).toBe("2026-07-28");
    expect(usuarioRve.email).toBe("rve@ejemplo.com");
    expect(usuarioRve.usuario).toBe("usuario.rve");
    expect(usuarioRve.password).toBe("hash-rve");
    expect(usuarioRve.rolId).toBe(4);
    expect(usuarioRve.rolPagoId).toBe(7);
    expect(usuarioRve.activo).toBe(true);
    expect(usuarioRve.save).toHaveBeenCalledWith({
      transaction: { id: "transaction" },
    });
    expect(sequelize.transaction).toHaveBeenCalled();
    expect(io.emit).toHaveBeenCalledWith(
      "novedades-personal:actualizar",
    );
  });
});
