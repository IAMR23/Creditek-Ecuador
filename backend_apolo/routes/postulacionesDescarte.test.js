const assert = require("node:assert/strict");
const { beforeEach, test } = require("node:test");
const express = require("express");
const jwt = require("jsonwebtoken");

const Postulacion = require("../models/Postulacion");
const postulacionesRouter = require("./postulacionesRouter");

let postulacion;
let saved;
let formularioChanged;

const patchDescarte = async (body) => {
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
      `http://127.0.0.1:${address.port}/api/postulaciones/21/descartada`,
      {
        method: "PATCH",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
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
  saved = 0;
  formularioChanged = false;
  postulacion = {
    id: 21,
    descartada: false,
    descartadaAt: null,
    observacion: "Observación general existente",
    formulario: { metadata: {} },
    changed: (field, value) => {
      if (field === "formulario" && value === true) formularioChanged = true;
    },
    save: async () => {
      saved += 1;
    },
  };
  Postulacion.findByPk = async () => postulacion;
  Postulacion.count = async () => 0;
});

test("exige un motivo para descartar al postulante", async () => {
  const response = await patchDescarte({ descartada: true });

  assert.equal(response.status, 400);
  assert.match(response.body.message, /Debe ingresar el motivo/);
  assert.equal(saved, 0);
});

test("guarda el motivo sin reemplazar la observacion general", async () => {
  const response = await patchDescarte({
    descartada: true,
    motivoDescarte: "No cumple con el perfil solicitado.",
  });

  assert.equal(response.status, 200);
  assert.equal(postulacion.descartada, true);
  assert.ok(postulacion.descartadaAt instanceof Date);
  assert.equal(
    postulacion.formulario.metadata.motivo_descarte,
    "No cumple con el perfil solicitado.",
  );
  assert.equal(postulacion.observacion, "Observación general existente");
  assert.equal(formularioChanged, true);
  assert.equal(saved, 1);
});

test("permite restaurar y conserva el ultimo motivo de descarte", async () => {
  postulacion.descartada = true;
  postulacion.formulario.metadata.motivo_descarte = "Motivo histórico";

  const response = await patchDescarte({ descartada: false });

  assert.equal(response.status, 200);
  assert.equal(postulacion.descartada, false);
  assert.equal(postulacion.descartadaAt, null);
  assert.equal(postulacion.formulario.metadata.motivo_descarte, "Motivo histórico");
  assert.equal(saved, 1);
});
