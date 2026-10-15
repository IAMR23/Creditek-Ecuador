const assert = require("node:assert/strict");
const { beforeEach, test } = require("node:test");
const express = require("express");
const jwt = require("jsonwebtoken");
const { Op } = require("sequelize");

const Postulacion = require("../models/Postulacion");
const postulacionesRouter = require("./postulacionesRouter");

const token = jwt.sign(
  { usuario: { id: 1, rol: { nombre: "ADMIN" } } },
  process.env.JWT_SECRET || "apolo_secret",
);

const request = async (path, options = {}) => {
  const app = express();
  app.use(express.json());
  app.use("/api/postulaciones", postulacionesRouter);

  const server = await new Promise((resolve) => {
    const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
  });

  try {
    const { port } = server.address();
    const response = await fetch(
      `http://127.0.0.1:${port}/api/postulaciones${path}`,
      {
        ...options,
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
          ...(options.headers || {}),
        },
      },
    );

    return { status: response.status, body: await response.json() };
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
};

beforeEach(() => {
  Postulacion.findAll = async () => [];
  Postulacion.create = async (payload) => ({ id: 101, ...payload });
  Postulacion.findAndCountAll = async () => ({ count: 0, rows: [] });
});

test("crea un postulante básico desde Pipeline en la etapa Postulación", async () => {
  let createdPayload = null;
  Postulacion.create = async (payload) => {
    createdPayload = payload;
    return { id: 101, ...payload };
  };

  const response = await request("/pipeline", {
    method: "POST",
    body: JSON.stringify({
      nombre: "  Ana Pérez  ",
      cedula: "171-234-5678",
    }),
  });

  assert.equal(response.status, 201);
  assert.equal(createdPayload.nombre, "Ana Pérez");
  assert.equal(createdPayload.cedula, "1712345678");
  assert.equal(createdPayload.leida, true);
  assert.equal(createdPayload.pasaEntrevista, false);
  assert.equal(createdPayload.descartada, false);
  assert.equal(createdPayload.formulario.metadata.origen, "pipeline");
  assert.equal(
    createdPayload.formulario.datos_personales.nombreCompleto,
    "Ana Pérez",
  );
});

test("rechaza una cédula ya registrada desde Pipeline", async () => {
  let createCalls = 0;
  Postulacion.findAll = async () => [{ id: 20 }];
  Postulacion.create = async () => {
    createCalls += 1;
  };

  const response = await request("/pipeline", {
    method: "POST",
    body: JSON.stringify({ nombre: "Ana Pérez", cedula: "1712345678" }),
  });

  assert.equal(response.status, 409);
  assert.equal(response.body.code, "CEDULA_DUPLICADA");
  assert.equal(createCalls, 0);
});

test("mueve un postulante entre todas las etapas del Pipeline", async () => {
  const postulacion = {
    id: 21,
    pasaEntrevista: false,
    pasaEntrevistaAt: null,
    fechaEntrevista: null,
    estadoEntrevista: "PENDIENTE",
    descartada: false,
    descartadaAt: null,
    formulario: {},
    changed: () => {},
    save: async () => {},
  };
  Postulacion.findByPk = async () => postulacion;

  const casos = [
    ["ENTREVISTA", true, "PENDIENTE", false],
    ["DATA", true, "SELECCIONADO", false],
    ["CAPACITACION", true, "CAPACITACION", false],
    ["PRODUCCION", true, "PRODUCCION", false],
    ["DESCARTE", true, "PRODUCCION", true],
    ["POSTULACION", false, "PENDIENTE", false],
  ];

  for (const [etapa, pasaEntrevista, estadoEntrevista, descartada] of casos) {
    const response = await request("/21/pipeline-etapa", {
      method: "PATCH",
      body: JSON.stringify({
        etapa,
        ...(etapa === "DESCARTE" ? { motivoDescarte: "No continúa" } : {}),
      }),
    });

    assert.equal(response.status, 200);
    assert.equal(postulacion.pasaEntrevista, pasaEntrevista);
    assert.equal(postulacion.estadoEntrevista, estadoEntrevista);
    assert.equal(postulacion.descartada, descartada);
  }

  assert.equal(postulacion.formulario.metadata.motivo_descarte, "No continúa");
});

test("la fase Producción consulta únicamente su estado", async () => {
  let listOptions = null;
  Postulacion.findAndCountAll = async (options) => {
    listOptions = options;
    return { count: 0, rows: [] };
  };

  const response = await request("/?fase=produccion&page=1&limit=100");

  assert.equal(response.status, 200);
  assert.equal(listOptions.where.pasaEntrevista, true);
  assert.equal(listOptions.where.descartada, false);
  assert.deepEqual(listOptions.where.estadoEntrevista[Op.in], ["PRODUCCION"]);
});

test("exige motivo al arrastrar un postulante a Descarte", async () => {
  let findCalls = 0;
  Postulacion.findByPk = async () => {
    findCalls += 1;
    return null;
  };

  const response = await request("/21/pipeline-etapa", {
    method: "PATCH",
    body: JSON.stringify({ etapa: "DESCARTE" }),
  });

  assert.equal(response.status, 400);
  assert.match(response.body.message, /motivo/i);
  assert.equal(findCalls, 0);
});

