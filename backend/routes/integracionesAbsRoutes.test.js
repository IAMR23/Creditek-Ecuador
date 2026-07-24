const express = require("express");
const request = require("supertest");

jest.mock("../config/db", () => ({
  sequelize: {
    transaction: jest.fn(async (callback) => callback({ id: "transaction" })),
  },
}));

jest.mock("../models/Usuario", () => ({
  findAll: jest.fn(),
  rawAttributes: {
    fechaSalidaRegistradaAt: {},
  },
}));

jest.mock("../models/UsuarioAgencia", () => ({
  update: jest.fn(),
}));

const { sequelize } = require("../config/db");
const Usuario = require("../models/Usuario");
const UsuarioAgencia = require("../models/UsuarioAgencia");
const integracionesAbsRoutes = require("./integracionesAbsRoutes");

const crearAplicacion = () => {
  const app = express();
  app.use(express.json());
  app.use("/api/integraciones/abs", integracionesAbsRoutes);
  return app;
};

const enviarSalida = (payload, token = "token-pruebas") =>
  request(crearAplicacion())
    .patch("/api/integraciones/abs/usuarios/salida")
    .set("x-internal-token", token)
    .send(payload);

describe("PATCH /api/integraciones/abs/usuarios/salida", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.RVE_SYNC_TOKEN = "token-pruebas";
  });

  afterAll(() => {
    delete process.env.RVE_SYNC_TOKEN;
  });

  test("rechaza peticiones sin el token interno correcto", async () => {
    const response = await enviarSalida(
      { cedula: "0102030405", fechaSalida: "2026-07-24" },
      "token-incorrecto",
    );

    expect(response.status).toBe(401);
    expect(response.body.sincronizado).toBe(false);
    expect(Usuario.findAll).not.toHaveBeenCalled();
  });

  test("valida cedula y fechas de calendario reales", async () => {
    const sinCedula = await enviarSalida({
      cedula: " ",
      fechaSalida: "2026-07-24",
    });
    const fechaInvalida = await enviarSalida({
      cedula: "0102030405",
      fechaSalida: "2026-02-30",
    });

    expect(sinCedula.status).toBe(400);
    expect(fechaInvalida.status).toBe(400);
    expect(Usuario.findAll).not.toHaveBeenCalled();
  });

  test("responde ok sin actualizar cuando la cedula no existe", async () => {
    Usuario.findAll.mockResolvedValue([]);

    const response = await enviarSalida({
      cedula: "0102030405",
      fechaSalida: "2026-07-24",
      origen: "ABS_MOVIMIENTOS_TERMINALES",
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual(
      expect.objectContaining({
        ok: true,
        sincronizado: false,
        cedula: "0102030405",
      }),
    );
    expect(sequelize.transaction).not.toHaveBeenCalled();
  });

  test("responde 409 y no modifica cuando la cedula esta duplicada", async () => {
    const usuarios = [
      { id: 1, save: jest.fn() },
      { id: 2, save: jest.fn() },
    ];
    Usuario.findAll.mockResolvedValue(usuarios);

    const response = await enviarSalida({
      cedula: "0102030405",
      fechaSalida: "2026-07-24",
    });

    expect(response.status).toBe(409);
    expect(response.body.sincronizado).toBe(false);
    expect(usuarios[0].save).not.toHaveBeenCalled();
    expect(usuarios[1].save).not.toHaveBeenCalled();
    expect(UsuarioAgencia.update).not.toHaveBeenCalled();
  });

  test("actualiza fecha y desactiva usuario y relaciones cuando se solicita", async () => {
    const usuario = {
      id: 15,
      cedula: "0102030405",
      fechaSalida: null,
      fechaSalidaRegistradaAt: null,
      activo: true,
      save: jest.fn().mockResolvedValue(undefined),
    };
    Usuario.findAll.mockResolvedValue([usuario]);
    UsuarioAgencia.update.mockResolvedValue([2]);

    const response = await enviarSalida({
      cedula: "0102030405",
      fechaSalida: "2026-07-24",
      desactivar: true,
      origen: "ABS_MOVIMIENTOS_TERMINALES",
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual(
      expect.objectContaining({
        ok: true,
        sincronizado: true,
        usuarioId: 15,
        fechaSalida: "2026-07-24",
        desactivado: true,
      }),
    );
    expect(usuario.fechaSalida).toBe("2026-07-24");
    expect(usuario.fechaSalidaRegistradaAt).toEqual(expect.any(Date));
    expect(usuario.activo).toBe(false);
    expect(usuario.save).toHaveBeenCalledWith({
      transaction: { id: "transaction" },
    });
    expect(UsuarioAgencia.update).toHaveBeenCalledWith(
      { activo: false },
      {
        where: { usuarioId: 15, activo: true },
        transaction: { id: "transaction" },
      },
    );
  });

  test("acepta null para sincronizar la limpieza de fechaSalida", async () => {
    const usuario = {
      id: 15,
      fechaSalida: "2026-07-24",
      fechaSalidaRegistradaAt: new Date(),
      activo: true,
      save: jest.fn().mockResolvedValue(undefined),
    };
    Usuario.findAll.mockResolvedValue([usuario]);

    const response = await enviarSalida({
      cedula: "0102030405",
      fechaSalida: null,
    });

    expect(response.status).toBe(200);
    expect(usuario.fechaSalida).toBeNull();
    expect(usuario.fechaSalidaRegistradaAt).toBeNull();
    expect(UsuarioAgencia.update).not.toHaveBeenCalled();
  });
});
