const assert = require("node:assert/strict");
const { beforeEach, test } = require("node:test");
const express = require("express");
const jwt = require("jsonwebtoken");

const Postulacion = require("../models/Postulacion");
const postulacionesRouter = require("./postulacionesRouter");

const buildTxt = (cedula = "0504838202") => `TITULAR
Nombre: POSTULANTE DE PRUEBA
Cedula: ${cedula}
Edad: 28
Lugar de nacimiento: Quito
Nivel de estudio: Bachiller

FAMILIAR 1 - MADRE
Nombre: FAMILIAR DE PRUEBA
Cedula: 1712345678
Edad: 55
Lugar de nacimiento: Quito
Nivel de estudio: Bachiller
`;

const postulacion = {
  id: 15,
  nombre: "Nombre anterior",
  cedula: "0504838202",
  formulario: {
    datos_personales: {
      nombreCompleto: "Nombre anterior",
      cedula: "0504838202",
      direccion: "Dirección existente",
    },
  },
  save: async () => {},
};

const patchTxt = async ({
  nombreArchivo = "consulta_0504838202_2026-07-27_11-38-23.txt",
  contenido = buildTxt(),
  path = "/familiares-txt/por-cedula",
} = {}) => {
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
        method: "PATCH",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ nombreArchivo, contenido }),
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
  postulacion.nombre = "Nombre anterior";
  postulacion.cedula = "0504838202";
  postulacion.formulario = {
    datos_personales: {
      nombreCompleto: "Nombre anterior",
      cedula: "0504838202",
      direccion: "Dirección existente",
    },
  };
  postulacion.save = async () => {};
  Postulacion.findAll = async () => [postulacion];
  Postulacion.findByPk = async () => postulacion;
});

test("asocia el TXT al postulante usando la cedula del nombre", async () => {
  let saved = 0;
  postulacion.save = async () => {
    saved += 1;
  };

  const response = await patchTxt();

  assert.equal(response.status, 200);
  assert.equal(response.body.data.postulacionId, 15);
  assert.equal(response.body.data.cedula, "0504838202");
  assert.equal(response.body.data.totalFamiliares, 1);
  assert.equal(saved, 1);
  assert.equal(postulacion.nombre, "POSTULANTE DE PRUEBA");
  assert.equal(
    postulacion.formulario.datos_personales.direccion,
    "Dirección existente",
  );
  assert.equal(
    postulacion.formulario.importacion_familiares_txt.nombreArchivo,
    "consulta_0504838202_2026-07-27_11-38-23.txt",
  );
  assert.equal(postulacion.formulario.familiares_postulante.length, 1);
});

test("no modifica registros si no encuentra la cedula", async () => {
  let saved = 0;
  Postulacion.findAll = async () => [];
  postulacion.save = async () => {
    saved += 1;
  };

  const response = await patchTxt();

  assert.equal(response.status, 404);
  assert.equal(response.body.code, "POSTULACION_NO_ENCONTRADA");
  assert.equal(saved, 0);
});

test("detiene la importacion si hay postulaciones duplicadas", async () => {
  Postulacion.findAll = async () => [postulacion, { ...postulacion, id: 16 }];

  const response = await patchTxt();

  assert.equal(response.status, 409);
  assert.equal(response.body.code, "POSTULACION_CEDULA_DUPLICADA");
});

test("valida que la cedula interna del TXT coincida con el archivo", async () => {
  const response = await patchTxt({
    contenido: buildTxt("0102030405"),
  });

  assert.equal(response.status, 409);
  assert.equal(response.body.code, "CEDULA_TXT_NO_COINCIDE");
});

test("rechaza nombres de archivo sin una cedula valida", async () => {
  const response = await patchTxt({
    nombreArchivo: "familia-postulante.txt",
  });

  assert.equal(response.status, 400);
  assert.equal(response.body.code, "NOMBRE_ARCHIVO_INVALIDO");
});

test("limita el tamaño de cada TXT sin afectar otros archivos del lote", async () => {
  const response = await patchTxt({
    contenido: `TITULAR\nNombre: ${"A".repeat(76 * 1024)}`,
  });

  assert.equal(response.status, 413);
  assert.equal(response.body.code, "TXT_DEMASIADO_GRANDE");
});

test("conserva la importacion TXT individual existente", async () => {
  const response = await patchTxt({
    path: "/15/familiares-txt",
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.parsed.familiares.length, 1);
  assert.equal(
    postulacion.formulario.importacion_familiares_txt.nombreArchivo,
    "consulta_0504838202_2026-07-27_11-38-23.txt",
  );
});
