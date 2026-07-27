const assert = require("node:assert/strict");
const { beforeEach, test } = require("node:test");
const express = require("express");

const Agencia = require("../models/Agencia");
const Rol = require("../models/Rol");
const Usuario = require("../models/Usuario");
const UsuarioAgencia = require("../models/UsuarioAgencia");
const bootstrapRoutes = require("./bootstrapRoutes");

const requestJson = async (body) => {
  const app = express();
  app.use(express.json());
  app.use("/bootstrap", bootstrapRoutes);

  const server = await new Promise((resolve) => {
    const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
  });

  try {
    const address = server.address();
    const response = await fetch(
      `http://127.0.0.1:${address.port}/bootstrap`,
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
  Usuario.count = async () => 0;
  Rol.findOne = async () => ({ id: 1, nombre: "ADMIN" });
  Agencia.findOne = async () => ({ id: 1, nombre: "Matriz" });
  Usuario.create = async (values) => ({
    id: 1,
    ...values,
    toJSON() {
      return { id: this.id, ...values };
    },
  });
  UsuarioAgencia.create = async (values) => ({ id: 1, ...values });
});

test("el bootstrap genera un usuario para la primera cuenta", async () => {
  let createdValues;
  Usuario.create = async (values) => {
    createdValues = values;
    return {
      id: 1,
      ...values,
      toJSON() {
        return { id: this.id, ...values };
      },
    };
  };

  const response = await requestJson({
    nombre: "Administrador",
    email: " ADMIN.ABS@EJEMPLO.COM ",
    password: "Clave123",
  });

  assert.equal(response.status, 201);
  assert.equal(createdValues.email, "admin.abs@ejemplo.com");
  assert.equal(createdValues.usuario, "admin.abs");
  assert.equal(response.body.usuario.password, undefined);
});

test("el bootstrap acepta y normaliza un usuario explícito", async () => {
  const response = await requestJson({
    nombre: "Administrador",
    email: "admin@ejemplo.com",
    usuario: " ADMIN_ABS ",
    password: "Clave123",
  });

  assert.equal(response.status, 201);
  assert.equal(response.body.usuario.usuario, "admin_abs");
});
