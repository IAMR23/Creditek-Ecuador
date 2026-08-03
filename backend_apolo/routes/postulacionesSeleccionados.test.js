const assert = require("node:assert/strict");
const { beforeEach, test } = require("node:test");
const express = require("express");
const jwt = require("jsonwebtoken");
const { Op } = require("sequelize");

const Postulacion = require("../models/Postulacion");
const Usuario = require("../models/Usuario");
const UsuarioAgencia = require("../models/UsuarioAgencia");
const postulacionesRouter = require("./postulacionesRouter");

let candidate;
let lastListOptions;
let saved;

const request = async (path, { method = "GET", body } = {}) => {
  const app = express();
  app.use(express.json());
  app.use("/api/postulaciones", postulacionesRouter);

  const server = await new Promise((resolve) => {
    const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
  });

  try {
    const address = server.address();
    const token = jwt.sign(
      { usuario: { id: 1 } },
      process.env.JWT_SECRET || "apolo_secret",
    );
    const response = await fetch(
      `http://127.0.0.1:${address.port}/api/postulaciones${path}`,
      {
        method,
        headers: {
          authorization: `Bearer ${token}`,
          ...(body ? { "content-type": "application/json" } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
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
  saved = 0;
  lastListOptions = null;
  candidate = {
    id: 21,
    nombre: "Postulante de prueba",
    pasaEntrevista: true,
    descartada: false,
    fechaEntrevista: new Date("2026-07-27T15:00:00.000Z"),
    estadoEntrevista: "REALIZADA",
    save: async () => {
      saved += 1;
    },
  };

  Postulacion.findByPk = async () => candidate;
  Postulacion.findAndCountAll = async (options) => {
    lastListOptions = options;
    return { count: 0, rows: [] };
  };
  Postulacion.count = async () => 0;
  Usuario.findAll = async () => [];
  UsuarioAgencia.findAll = async () => [];
});

test("la lista de Entrevistas excluye a los postulantes seleccionados", async () => {
  const response = await request("/?fase=entrevista");

  assert.equal(response.status, 200);
  assert.equal(lastListOptions.where.pasaEntrevista, true);
  assert.equal(lastListOptions.where.descartada, false);
  assert.deepEqual(
    lastListOptions.where.estadoEntrevista[Op.notIn],
    ["SELECCIONADO", "NO_ASISTIO_CAP"],
  );
});

test("la fase Seleccionados incluye sus estados finales", async () => {
  const response = await request("/?fase=seleccionado");

  assert.equal(response.status, 200);
  assert.equal(lastListOptions.where.pasaEntrevista, true);
  assert.equal(lastListOptions.where.descartada, false);
  assert.deepEqual(
    lastListOptions.where.estadoEntrevista[Op.in],
    ["SELECCIONADO", "NO_ASISTIO_CAP"],
  );
});

test("Seleccionados incluye la fecha de ingreso y la agencia del usuario creado", async () => {
  Postulacion.findAndCountAll = async (options) => {
    lastListOptions = options;
    return {
      count: 1,
      rows: [
        {
          id: 21,
          cedula: "0102030405",
          estadoEntrevista: "SELECCIONADO",
          formulario: {},
        },
      ],
    };
  };
  Usuario.findAll = async () => [
    {
      id: 50,
      cedula: "0102030405",
      fechaIngreso: "2026-08-03",
    },
  ];
  UsuarioAgencia.findAll = async () => [
    {
      id: 70,
      usuarioId: 50,
      agenciaId: 2,
      agencia: { id: 2, nombre: "Matriz" },
    },
  ];

  const response = await request("/?fase=seleccionado");

  assert.equal(response.status, 200);
  assert.deepEqual(response.body.data[0].incorporacion, {
    usuarioId: 50,
    fechaIngreso: "2026-08-03",
    agencia: { id: 2, nombre: "Matriz" },
  });
});

test("permite marcar una entrevista agendada como seleccionada", async () => {
  const response = await request("/21/estado-entrevista", {
    method: "PATCH",
    body: { estadoEntrevista: "SELECCIONADO" },
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.data.estadoEntrevista, "SELECCIONADO");
  assert.equal(candidate.estadoEntrevista, "SELECCIONADO");
  assert.equal(saved, 1);
});

test("el resumen separa los contadores de Entrevistas y Seleccionados", async () => {
  Postulacion.count = async (options = {}) => {
    const where = options.where || {};

    if (
      where.estadoEntrevista?.[Op.in]?.includes("SELECCIONADO") &&
      where.estadoEntrevista?.[Op.in]?.includes("NO_ASISTIO_CAP")
    ) {
      return 3;
    }
    if (
      where.pasaEntrevista === true &&
      where.descartada === false &&
      where.estadoEntrevista?.[Op.notIn]?.includes("SELECCIONADO") &&
      where.estadoEntrevista?.[Op.notIn]?.includes("NO_ASISTIO_CAP") &&
      Object.keys(where).length === 3
    ) {
      return 5;
    }

    return 0;
  };

  const response = await request("/resumen");

  assert.equal(response.status, 200);
  assert.equal(response.body.data.entrevistas, 5);
  assert.equal(response.body.data.seleccionados, 3);
});
