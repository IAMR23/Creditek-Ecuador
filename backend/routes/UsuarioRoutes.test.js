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

jest.mock("../models/UsuarioRolPago", () => ({
  bulkCreate: jest.fn(),
  destroy: jest.fn(),
}));

jest.mock("../models/RolPago", () => ({
  findAll: jest.fn(),
  findOne: jest.fn(),
}));

jest.mock("../models/NominaEmpleado", () => ({
  update: jest.fn(),
}));

jest.mock("../services/notificacionesPersonalService", () => ({
  registrarNotificacionSalida: jest.fn().mockResolvedValue({ id: 2 }),
  registrarNotificacionSegura: jest.fn(async (promesa) => promesa),
  registrarNotificacionUsuarioCreado: jest.fn().mockResolvedValue({ id: 1 }),
}));

const Usuario = require("../models/Usuario");
const Rol = require("../models/Rol");
const RolPago = require("../models/RolPago");
const UsuarioRolPago = require("../models/UsuarioRolPago");
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

  test("guarda varios cargos y conserva como principal el mejor pagado", async () => {
    RolPago.findAll.mockResolvedValue([
      {
        id: 2,
        nivel: "ASISTENTE",
        cargo: "VENDEDOR DE PISO",
        sueldoBase: 500,
        sueldoExtra: 100,
        ingresoMax: 900,
      },
      {
        id: 15,
        nivel: "JEFE",
        cargo: "JEFE COMERCIAL DE PISO",
        sueldoBase: 1200,
        sueldoExtra: 200,
        ingresoMax: 1900,
      },
    ]);
    Usuario.create.mockImplementation(async (data) => ({
      id: 30,
      ...data,
      toJSON: () => ({ id: 30, ...data }),
    }));

    const response = await request(crearAplicacion())
      .post("/usuarios")
      .send({
        ...payloadValido,
        rolesPagoIds: [2, 15],
      });

    expect(response.status).toBe(201);
    expect(Usuario.create).toHaveBeenCalledWith(
      expect.objectContaining({ rolPagoId: 15 }),
    );
    expect(UsuarioRolPago.bulkCreate).toHaveBeenCalledWith([
      { usuarioId: 30, rolPagoId: 2 },
      { usuarioId: 30, rolPagoId: 15 },
    ]);
  });

  test("guarda el usuario de Uphone al crear un usuario", async () => {
    Usuario.create.mockImplementation(async (data) => ({
      id: 31,
      ...data,
      toJSON: () => ({ id: 31, ...data }),
    }));

    const response = await request(crearAplicacion())
      .post("/usuarios")
      .send({
        ...payloadValido,
        usuarioUphone: "  asesor.uphone  ",
      });

    expect(response.status).toBe(201);
    expect(Usuario.create).toHaveBeenCalledWith(
      expect.objectContaining({ usuarioUphone: "asesor.uphone" }),
    );
  });

  test("crea usuarios afiliados y de tiempo completo por defecto", async () => {
    Usuario.create.mockImplementation(async (data) => ({
      id: 32,
      ...data,
      toJSON: () => ({ id: 32, ...data }),
    }));

    const response = await request(crearAplicacion())
      .post("/usuarios")
      .send(payloadValido);

    expect(response.status).toBe(201);
    expect(Usuario.create).toHaveBeenCalledWith(
      expect.objectContaining({
        jornadaLaboral: "tiempo_completo",
        afiliadoIess: true,
      }),
    );
  });

  test("permite crear un usuario de medio tiempo no afiliado", async () => {
    Usuario.create.mockImplementation(async (data) => ({
      id: 33,
      ...data,
      toJSON: () => ({ id: 33, ...data }),
    }));

    const response = await request(crearAplicacion())
      .post("/usuarios")
      .send({
        ...payloadValido,
        jornadaLaboral: "medio_tiempo",
        afiliadoIess: false,
      });

    expect(response.status).toBe(201);
    expect(Usuario.create).toHaveBeenCalledWith(
      expect.objectContaining({
        jornadaLaboral: "medio_tiempo",
        afiliadoIess: false,
      }),
    );
  });

  test("rechaza un usuario Uphone ya asignado", async () => {
    Usuario.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 99, usuarioUphone: "ARI2028" });

    const response = await request(crearAplicacion())
      .post("/usuarios")
      .send({
        ...payloadValido,
        usuarioUphone: "ARI2028",
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe(
      "El usuario Uphone ya esta asignado a otro usuario.",
    );
    expect(Usuario.create).not.toHaveBeenCalled();
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

  test("actualiza todos los cargos salariales seleccionados", async () => {
    const usuario = {
      id: 21,
      rolPagoId: 2,
      save: jest.fn().mockResolvedValue(undefined),
      toJSON() {
        return { id: this.id, rolPagoId: this.rolPagoId };
      },
    };
    Usuario.findByPk.mockResolvedValue(usuario);
    RolPago.findAll.mockResolvedValue([
      {
        id: 2,
        nivel: "ASISTENTE",
        cargo: "VENDEDOR DE PISO",
        sueldoBase: 600,
        sueldoExtra: 0,
        ingresoMax: 900,
      },
      {
        id: 16,
        nivel: "SUPERVISOR",
        cargo: "SUPERVISOR PISO",
        sueldoBase: 1000,
        sueldoExtra: 100,
        ingresoMax: 1500,
      },
    ]);

    const response = await request(crearAplicacion())
      .put("/usuarios/21")
      .send({ rolesPagoIds: [2, 16] });

    expect(response.status).toBe(200);
    expect(usuario.rolPagoId).toBe(16);
    expect(UsuarioRolPago.destroy).toHaveBeenCalledWith({
      where: { usuarioId: 21 },
    });
    expect(UsuarioRolPago.bulkCreate).toHaveBeenCalledWith([
      { usuarioId: 21, rolPagoId: 2 },
      { usuarioId: 21, rolPagoId: 16 },
    ]);
  });

  test("actualiza el usuario de Uphone y permite limpiarlo", async () => {
    const usuario = {
      id: 22,
      usuarioUphone: "anterior",
      save: jest.fn().mockResolvedValue(undefined),
      toJSON() {
        return { id: this.id, usuarioUphone: this.usuarioUphone };
      },
    };
    Usuario.findByPk.mockResolvedValue(usuario);

    const response = await request(crearAplicacion())
      .put("/usuarios/22")
      .send({ usuarioUphone: "   " });

    expect(response.status).toBe(200);
    expect(usuario.usuarioUphone).toBeNull();
    expect(usuario.save).toHaveBeenCalled();
  });

  test("rechaza asignar en edicion un usuario Uphone usado por otra persona", async () => {
    const usuario = {
      id: 23,
      usuarioUphone: null,
      save: jest.fn().mockResolvedValue(undefined),
    };
    Usuario.findByPk.mockResolvedValue(usuario);
    Usuario.findOne.mockResolvedValue({ id: 50, usuarioUphone: "FER2028" });

    const response = await request(crearAplicacion())
      .put("/usuarios/23")
      .send({ usuarioUphone: "FER2028" });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe(
      "El usuario Uphone ya esta asignado a otro usuario.",
    );
    expect(usuario.save).not.toHaveBeenCalled();
  });

  test("actualiza jornada laboral y afiliacion", async () => {
    const usuario = {
      id: 24,
      jornadaLaboral: "tiempo_completo",
      afiliadoIess: true,
      save: jest.fn().mockResolvedValue(undefined),
      toJSON() {
        return {
          id: this.id,
          jornadaLaboral: this.jornadaLaboral,
          afiliadoIess: this.afiliadoIess,
        };
      },
    };
    Usuario.findByPk.mockResolvedValue(usuario);

    const response = await request(crearAplicacion())
      .put("/usuarios/24")
      .send({
        jornadaLaboral: "medio_tiempo",
        afiliadoIess: false,
      });

    expect(response.status).toBe(200);
    expect(usuario.jornadaLaboral).toBe("medio_tiempo");
    expect(usuario.afiliadoIess).toBe(false);
    expect(usuario.save).toHaveBeenCalled();
  });

  test("rechaza una jornada laboral desconocida", async () => {
    const usuario = {
      id: 25,
      save: jest.fn().mockResolvedValue(undefined),
    };
    Usuario.findByPk.mockResolvedValue(usuario);

    const response = await request(crearAplicacion())
      .put("/usuarios/25")
      .send({ jornadaLaboral: "por_horas" });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe(
      "La jornada laboral debe ser tiempo completo o medio tiempo.",
    );
    expect(usuario.save).not.toHaveBeenCalled();
  });
});
