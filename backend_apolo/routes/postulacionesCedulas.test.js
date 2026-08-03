const assert = require("node:assert/strict");
const { beforeEach, test } = require("node:test");
const express = require("express");
const jwt = require("jsonwebtoken");
const { Op } = require("sequelize");

const Postulacion = require("../models/Postulacion");
const postulacionesRouter = require("./postulacionesRouter");

let findAllOptions;

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
  findAllOptions = null;
  Postulacion.findAll = async (options) => {
    findAllOptions = options;
    return [
      { cedula: "1723900146" },
      { cedula: " 1750229880 " },
      { cedula: "1723900146" },
      { cedula: null },
      { cedula: "invalida" },
    ];
  };
});

test("exporta todas las cedulas unicas que cumplen los filtros", async () => {
  const response = await request(
    "/cedulas?fase=postulacion&estudiaActualmente=no&fechaDesde=2026-08-01&fechaHasta=2026-08-03",
  );

  assert.equal(response.status, 200);
  assert.deepEqual(response.body.data, {
    cedulas: ["1723900146", "1750229880"],
    total: 2,
  });
  assert.equal(findAllOptions.where.pasaEntrevista, false);
  assert.equal(findAllOptions.where.descartada, false);
  assert.equal(findAllOptions.where[Op.and].length, 1);
  assert.equal(
    findAllOptions.where.createdAt[Op.gte].toISOString(),
    "2026-08-01T05:00:00.000Z",
  );
  assert.equal(
    findAllOptions.where.createdAt[Op.lte].toISOString(),
    "2026-08-04T04:59:59.999Z",
  );
  assert.deepEqual(findAllOptions.attributes, ["cedula"]);
  assert.equal(findAllOptions.raw, true);
});
