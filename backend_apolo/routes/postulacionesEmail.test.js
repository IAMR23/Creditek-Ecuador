const assert = require("node:assert/strict");
const { beforeEach, test } = require("node:test");
const express = require("express");

const Postulacion = require("../models/Postulacion");
const postulacionesRouter = require("./postulacionesRouter");

let createdPayload;

const validPayload = (overrides = {}) => ({
  datos_personales: {
    nombreCompleto: "Postulante de Prueba",
    cedula: "1712345678",
    telefono: "0999999999",
    email: " Postulante@Ejemplo.com ",
    edadCumplida: "25",
    numeroHijos: "0",
    estadoCivil: "Soltero",
    tieneTituloTercerNivel: "No",
    estudiaActualmente: "No",
    ciudadNacimiento: "Quito",
    direccion: "Quito",
    ...overrides,
  },
  residencia_quito: {},
  vivienda_actual: { tipoVivienda: "Arrendada" },
  personas_con_quien_vive: [],
  historial_laboral: [],
  observaciones: {},
});

const request = async (body) => {
  const app = express();
  app.use(express.json());
  app.use("/api/postulaciones", postulacionesRouter);

  const server = await new Promise((resolve) => {
    const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
  });

  try {
    const { port } = server.address();
    const response = await fetch(`http://127.0.0.1:${port}/api/postulaciones`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });

    return { status: response.status, body: await response.json() };
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
};

beforeEach(() => {
  createdPayload = null;
  Postulacion.create = async (payload) => {
    createdPayload = payload;
    return { id: 101, ...payload };
  };
});

test("guarda el correo normalizado dentro de los datos personales", async () => {
  const response = await request(validPayload());

  assert.equal(response.status, 201);
  assert.equal(
    createdPayload.formulario.datos_personales.email,
    "postulante@ejemplo.com",
  );
});

test("rechaza una postulación sin correo electrónico", async () => {
  const response = await request(validPayload({ email: "" }));

  assert.equal(response.status, 400);
  assert.match(response.body.message, /Correo electrónico es obligatorio/);
  assert.equal(createdPayload, null);
});

test("rechaza un correo electrónico con formato inválido", async () => {
  const response = await request(validPayload({ email: "correo-invalido" }));

  assert.equal(response.status, 400);
  assert.match(response.body.message, /Correo electrónico no es válido/);
  assert.equal(createdPayload, null);
});
