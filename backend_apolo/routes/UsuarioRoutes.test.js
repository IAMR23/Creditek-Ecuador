const assert = require("node:assert/strict");
const { beforeEach, test } = require("node:test");
const express = require("express");

const { sequelize } = require("../config/db");
const Agencia = require("../models/Agencia");
const Rol = require("../models/Rol");
const Usuario = require("../models/Usuario");
const UsuarioAgencia = require("../models/UsuarioAgencia");
const usuarioRoutes = require("./UsuarioRoutes");

const requestJson = async (path, options = {}) => {
  const app = express();
  app.use(express.json());
  app.use("/usuarios", usuarioRoutes);

  const server = await new Promise((resolve) => {
    const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
  });

  try {
    const address = server.address();
    const response = await fetch(
      `http://127.0.0.1:${address.port}/usuarios${path}`,
      {
        method: options.method || "GET",
        headers: options.body
          ? { "content-type": "application/json" }
          : undefined,
        body: options.body ? JSON.stringify(options.body) : undefined,
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

const validPayload = {
  nombre: "  María José Pérez  ",
  cedula: " 0102030405 ",
  email: " MARIA.PEREZ@EJEMPLO.COM ",
  password: "Clave123",
  rolId: 2,
  agenciaId: 4,
  fechaIngreso: "2026-07-27",
  fechaSalida: null,
  numeroCuenta: "",
  direccion: " Av. Principal ",
  telefono: " 0999999999 ",
};

beforeEach(() => {
  sequelize.transaction = async (_options, callback) =>
    callback({ id: "transaction" });
  Usuario.findOne = async () => null;
  Usuario.findAll = async () => [];
  Usuario.create = async (values) => ({
    id: 30,
    ...values,
    toJSON() {
      return { id: this.id, ...values };
    },
  });
  Rol.findByPk = async () => ({ id: 2, nombre: "USUARIO" });
  Agencia.findByPk = async () => ({ id: 4, nombre: "Matriz" });
  UsuarioAgencia.create = async (values) => ({ id: 90, ...values });
});

test("crea usuario y agencia en una sola transaccion", async () => {
  const usuariosCreados = [];
  const relacionesCreadas = [];

  Usuario.create = async (values, options) => {
    usuariosCreados.push({ values, options });
    return {
      id: 30,
      ...values,
      toJSON() {
        return { id: this.id, ...values };
      },
    };
  };
  UsuarioAgencia.create = async (values, options) => {
    relacionesCreadas.push({ values, options });
    return { id: 90, ...values };
  };

  const response = await requestJson("", {
    method: "POST",
    body: validPayload,
  });

  assert.equal(response.status, 201);
  assert.equal(response.body.nombre, "María José Pérez");
  assert.equal(response.body.cedula, "0102030405");
  assert.equal(response.body.email, "maria.perez@ejemplo.com");
  assert.equal(response.body.password, undefined);
  assert.equal(usuariosCreados.length, 1);
  assert.equal(relacionesCreadas.length, 1);
  assert.deepEqual(relacionesCreadas[0].values, {
    usuarioId: 30,
    agenciaId: 4,
    activo: true,
  });
  assert.equal(
    usuariosCreados[0].options.transaction,
    relacionesCreadas[0].options.transaction,
  );
});

test("no crea un segundo usuario con la misma cedula", async () => {
  let findOneCalls = 0;
  let createCalls = 0;

  Usuario.findOne = async () => {
    findOneCalls += 1;
    return findOneCalls === 1
      ? { id: 8, cedula: "0102030405" }
      : null;
  };
  Usuario.create = async () => {
    createCalls += 1;
  };

  const response = await requestJson("", {
    method: "POST",
    body: validPayload,
  });

  assert.equal(response.status, 409);
  assert.equal(response.body.code, "CEDULA_DUPLICADA");
  assert.equal(createCalls, 0);
});

test("exige una agencia para no dejar usuarios incompletos", async () => {
  const response = await requestJson("", {
    method: "POST",
    body: { ...validPayload, agenciaId: "" },
  });

  assert.equal(response.status, 400);
  assert.equal(response.body.code, "AGENCIA_REQUERIDA");
});

test("consulta si una cedula ya pertenece a un usuario", async () => {
  Usuario.findAll = async () => [
    {
      id: 8,
      nombre: "María José Pérez",
      cedula: "0102030405",
      activo: false,
    },
  ];

  const response = await requestJson("/por-cedula/0102030405");

  assert.equal(response.status, 200);
  assert.equal(response.body.existe, true);
  assert.equal(response.body.usuario.id, 8);
  assert.equal(response.body.usuario.activo, false);
});

test("detiene el flujo si ya existen varias cuentas con la misma cedula", async () => {
  Usuario.findAll = async () => [{ id: 8 }, { id: 9 }];

  const response = await requestJson("/por-cedula/0102030405");

  assert.equal(response.status, 409);
  assert.equal(response.body.code, "CEDULA_DUPLICADA_MULTIPLE");
});
