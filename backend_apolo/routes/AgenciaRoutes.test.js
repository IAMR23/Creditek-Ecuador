const assert = require("node:assert/strict");
const { test } = require("node:test");
const express = require("express");

const Agencia = require("../models/Agencia");
const agenciaRoutes = require("./AgenciaRoutes");

const request = async (path, { method = "GET", body } = {}) => {
  const app = express();
  app.use(express.json());
  app.use("/agencias", agenciaRoutes);

  const server = await new Promise((resolve) => {
    const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
  });

  try {
    const address = server.address();
    const response = await fetch(`http://127.0.0.1:${address.port}/agencias${path}`, {
      method,
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });

    return { status: response.status, body: await response.json() };
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
};

test("crea y ordena agencias antes de departamentos", async () => {
  let createdValues;
  let listOptions;
  Agencia.findOne = async () => null;
  Agencia.create = async (values) => {
    createdValues = values;
    return { id: 8, ...values };
  };
  Agencia.findAll = async (options) => {
    listOptions = options;
    return [];
  };
  const agencyToUpdate = {
    id: 8,
    nombre: "Talento Humano",
    tipo: "DEPARTAMENTO",
    save: async () => {},
  };
  Agencia.findByPk = async () => agencyToUpdate;

  const created = await request("/", {
    method: "POST",
    body: { nombre: "Talento Humano", tipo: "departamento" },
  });
  const invalid = await request("/", {
    method: "POST",
    body: { nombre: "Unidad inválida", tipo: "SUCURSAL" },
  });
  const updated = await request("/8", {
    method: "PUT",
    body: { tipo: "agencia" },
  });
  const listed = await request("/");

  assert.equal(created.status, 201);
  assert.equal(createdValues.tipo, "DEPARTAMENTO");
  assert.equal(invalid.status, 400);
  assert.match(invalid.body.message, /AGENCIA o DEPARTAMENTO/);
  assert.equal(updated.status, 200);
  assert.equal(agencyToUpdate.tipo, "AGENCIA");
  assert.equal(listed.status, 200);
  assert.deepEqual(listOptions.order, [
    ["tipo", "ASC"],
    ["nombre", "ASC"],
  ]);
});
