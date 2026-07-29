const assert = require("node:assert/strict");
const { beforeEach, test } = require("node:test");
const express = require("express");
const jwt = require("jsonwebtoken");
const { PDFDocument } = require("pdf-lib");

const Postulacion = require("../models/Postulacion");
const Usuario = require("../models/Usuario");
const postulacionesRouter = require("./postulacionesRouter");

const crearPostulacion = (overrides = {}) => ({
  id: 12,
  nombre: "María José Pérez",
  cedula: "0102030405",
  formulario: {},
  pasaEntrevista: true,
  descartada: false,
  ...overrides,
});

const getContrato = async ({ id = "12", token = true } = {}) => {
  const app = express();
  app.use(express.json());
  app.use("/api/postulaciones", postulacionesRouter);

  const server = await new Promise((resolve) => {
    const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
  });

  try {
    const address = server.address();
    const headers = {};

    if (token) {
      headers.authorization = `Bearer ${jwt.sign(
        { usuario: { id: 1 } },
        process.env.JWT_SECRET || "apolo_secret",
      )}`;
    }

    return await fetch(
      `http://127.0.0.1:${address.port}/api/postulaciones/${id}/contrato-capacitacion.pdf`,
      { headers },
    );
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
};

beforeEach(() => {
  Postulacion.findByPk = async () => crearPostulacion();
  Usuario.findOne = async () => ({
    id: 44,
    fechaIngreso: "2026-07-29",
  });
});

test("descarga el contrato PDF autenticado para una entrevista activa", async () => {
  const response = await getContrato();
  const bytes = Buffer.from(await response.arrayBuffer());
  const document = await PDFDocument.load(bytes);

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "application/pdf");
  assert.match(
    response.headers.get("content-disposition"),
    /acuerdo-capacitacion-0102030405\.pdf/,
  );
  assert.equal(document.getPageCount(), 4);
});

test("exige autenticacion", async () => {
  const response = await getContrato({ token: false });
  const body = await response.json();

  assert.equal(response.status, 401);
  assert.equal(body.code, "TOKEN_MISSING");
});

test("rechaza postulaciones fuera de Entrevistas", async () => {
  Postulacion.findByPk = async () =>
    crearPostulacion({ pasaEntrevista: false });

  const response = await getContrato();
  const body = await response.json();

  assert.equal(response.status, 409);
  assert.match(body.message, /Entrevistas/);
});

test("exige crear el usuario antes de generar el contrato", async () => {
  Usuario.findOne = async () => null;

  const response = await getContrato();
  const body = await response.json();

  assert.equal(response.status, 422);
  assert.match(body.message, /crear el usuario/i);
});

test("exige la fecha de ingreso del usuario", async () => {
  Usuario.findOne = async () => ({
    id: 44,
    fechaIngreso: null,
  });

  const response = await getContrato();
  const body = await response.json();

  assert.equal(response.status, 422);
  assert.match(body.message, /fecha de ingreso/i);
});

test("informa cuando falta la cedula", async () => {
  Postulacion.findByPk = async () =>
    crearPostulacion({ cedula: "", formulario: {} });

  const response = await getContrato();
  const body = await response.json();

  assert.equal(response.status, 422);
  assert.match(body.message, /c[eé]dula/i);
});
