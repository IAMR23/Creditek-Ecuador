const assert = require("node:assert/strict");
const { beforeEach, test } = require("node:test");
const express = require("express");
const jwt = require("jsonwebtoken");
const { Op } = require("sequelize");

const Postulacion = require("../models/Postulacion");
const postulacionesRouter = require("./postulacionesRouter");

let countCalls;

const request = async (path) => {
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
      { headers: { authorization: `Bearer ${token}` } },
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
  countCalls = [];
  const values = [12, 8, 3, 2, 4, 7, 5, 30];

  Postulacion.count = async (options = {}) => {
    countCalls.push(options);
    return values[countCalls.length - 1];
  };
});

test("el dashboard devuelve sus indicadores filtrados por fecha de postulacion", async () => {
  const response = await request(
    "/dashboard?fechaDesde=2026-07-01&fechaHasta=2026-07-31",
  );

  assert.equal(response.status, 200);
  assert.deepEqual(response.body.data, {
    postulaciones: 12,
    entrevistas: 8,
    seleccionados: 3,
    capacitacion: 2,
    descartados: 4,
    conTitulo: 7,
    estudiando: 5,
    totalPeriodo: 30,
  });
  assert.equal(countCalls.length, 8);

  countCalls.forEach(({ where }) => {
    assert.equal(
      where.createdAt[Op.gte].toISOString(),
      "2026-07-01T05:00:00.000Z",
    );
    assert.equal(
      where.createdAt[Op.lte].toISOString(),
      "2026-08-01T04:59:59.999Z",
    );
  });

  assert.equal(countCalls[0].where.pasaEntrevista, false);
  assert.equal(countCalls[0].where.descartada, false);
  assert.equal(countCalls[1].where.pasaEntrevista, true);
  assert.equal(countCalls[1].where.descartada, false);
  assert.deepEqual(countCalls[1].where.estadoEntrevista[Op.notIn], [
    "SELECCIONADO",
    "CAPACITACION",
    "NO_ASISTIO_CAP",
  ]);
  assert.deepEqual(countCalls[2].where.estadoEntrevista[Op.in], ["SELECCIONADO"]);
  assert.deepEqual(countCalls[3].where.estadoEntrevista[Op.in], [
    "CAPACITACION",
    "NO_ASISTIO_CAP",
  ]);
  assert.equal(countCalls[4].where.descartada, true);
  assert.equal(countCalls[5].where[Op.and].length, 1);
  assert.equal(countCalls[6].where[Op.and].length, 1);
});
