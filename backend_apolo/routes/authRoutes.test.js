const assert = require("node:assert/strict");
const { after, beforeEach, test } = require("node:test");
const express = require("express");
const bcrypt = require("bcryptjs");
const { Op } = require("sequelize");

const Usuario = require("../models/Usuario");
const UsuarioAgencia = require("../models/UsuarioAgencia");
const authRoutes = require("./authRoutes");

const originalCompare = bcrypt.compare;
let capturedFindOneOptions;

const requestJson = async (body) => {
  const app = express();
  app.use(express.json());
  app.use("/auth", authRoutes);

  const server = await new Promise((resolve) => {
    const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
  });

  try {
    const address = server.address();
    const response = await fetch(
      `http://127.0.0.1:${address.port}/auth/login`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      },
    );

    return {
      status: response.status,
      body: await response.json(),
    };
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
};

beforeEach(() => {
  capturedFindOneOptions = null;
  bcrypt.compare = async () => true;

  Usuario.findOne = async (options) => {
    capturedFindOneOptions = options;
    return {
      id: 7,
      nombre: "María Pérez",
      email: "maria.perez@ejemplo.com",
      usuario: "maria.perez",
      password: "$2b$10$hash",
      activo: true,
    };
  };

  Usuario.findByPk = async () => ({
    id: 7,
    nombre: "María Pérez",
    email: "maria.perez@ejemplo.com",
    usuario: "maria.perez",
    activo: true,
    rol: { id: 2, nombre: "USUARIO" },
  });

  UsuarioAgencia.findAll = async () => [
    {
      id: 15,
      agencia: {
        id: 4,
        nombre: "Matriz",
        direccion: "Av. Principal",
        telefono: "0999999999",
        ciudad: "Quito",
      },
    },
  ];
});

after(() => {
  bcrypt.compare = originalCompare;
});

test("permite iniciar sesión con nombre de usuario", async () => {
  const response = await requestJson({
    identificador: "  MARIA.PEREZ ",
    password: "Clave123",
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.user.usuario, "maria.perez");
  assert.equal(response.body.user.email, "maria.perez@ejemplo.com");
  assert.ok(response.body.accessToken);
  assert.equal(capturedFindOneOptions.where[Op.or].length, 2);
});

test("mantiene compatibilidad con el payload anterior basado en email", async () => {
  const response = await requestJson({
    email: "maria.perez@ejemplo.com",
    password: "Clave123",
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.user.id, 7);
});

test("rechaza solicitudes sin correo ni usuario", async () => {
  let findOneCalls = 0;
  Usuario.findOne = async () => {
    findOneCalls += 1;
    return null;
  };

  const response = await requestJson({ password: "Clave123" });

  assert.equal(response.status, 400);
  assert.equal(response.body.message, "Usuario o contraseña incorrectos");
  assert.equal(findOneCalls, 0);
});

test("rechaza una contraseña incorrecta", async () => {
  bcrypt.compare = async () => false;

  const response = await requestJson({
    identificador: "maria.perez",
    password: "Incorrecta1",
  });

  assert.equal(response.status, 400);
  assert.equal(response.body.message, "Usuario o contraseña incorrectos");
});
