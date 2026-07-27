const assert = require("node:assert/strict");
const { beforeEach, test } = require("node:test");
const express = require("express");

const Usuario = require("../models/Usuario");
const integracionesRveRoutes = require("./integracionesRveRoutes");

const getJson = async (cedula, token = "token-abs") => {
  const app = express();
  app.use(express.json());
  app.use("/api/integraciones/rve", integracionesRveRoutes);

  const server = await new Promise((resolve) => {
    const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
  });

  try {
    const address = server.address();
    const response = await fetch(
      `http://127.0.0.1:${address.port}/api/integraciones/rve/usuarios/por-cedula/${encodeURIComponent(cedula)}`,
      { headers: { "x-internal-token": token } },
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
  process.env.ABS_SYNC_TOKEN = "token-abs";
  Usuario.findAll = async () => [];
});

test("protege la consulta con token interno", async () => {
  const response = await getJson("0102030405", "incorrecto");

  assert.equal(response.status, 401);
  assert.equal(response.body.encontrado, false);
});

test("responde sin datos cuando la cedula no existe en ABS", async () => {
  const response = await getJson("0102030405");

  assert.equal(response.status, 200);
  assert.equal(response.body.ok, true);
  assert.equal(response.body.encontrado, false);
  assert.equal(response.body.usuario, null);
});

test("devuelve solo los datos seguros del usuario ABS", async () => {
  Usuario.findAll = async () => [
    {
      id: 8,
      cedula: "0102030405",
      nombre: "María Pérez",
      email: "maria@ejemplo.com",
      usuario: "maria.perez",
      fechaIngreso: "2026-07-01",
      fechaSalida: null,
      numeroCuenta: "123",
      direccion: "Quito",
      telefono: "0999999999",
      activo: true,
    },
  ];

  const response = await getJson("0102030405");

  assert.equal(response.status, 200);
  assert.equal(response.body.encontrado, true);
  assert.equal(response.body.usuario.cedula, "0102030405");
  assert.equal(response.body.usuario.password, undefined);
  assert.equal(response.body.usuario.rolId, undefined);
});

test("rechaza la consulta si la cedula esta duplicada en ABS", async () => {
  Usuario.findAll = async () => [{ id: 8 }, { id: 9 }];

  const response = await getJson("0102030405");

  assert.equal(response.status, 409);
  assert.equal(response.body.encontrado, false);
});
