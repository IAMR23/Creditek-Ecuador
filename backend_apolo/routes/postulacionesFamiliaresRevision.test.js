const assert = require("node:assert/strict");
const { beforeEach, test } = require("node:test");
const express = require("express");
const jwt = require("jsonwebtoken");

const Postulacion = require("../models/Postulacion");
const postulacionesRouter = require("./postulacionesRouter");

let postulacion;
let saved;
let formularioMarkedAsChanged;

const patchFamiliar = async (body) => {
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
      `http://127.0.0.1:${address.port}/api/postulaciones/21/familiares/0`,
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
  formularioMarkedAsChanged = false;
  postulacion = {
    id: 21,
    formulario: {
      familiares_postulante: [
        {
          nombre: "Familiar de prueba",
          limpio: false,
          observacion: "",
        },
      ],
      metadata: {},
    },
    changed: (field, value) => {
      if (field === "formulario" && value === true) {
        formularioMarkedAsChanged = true;
      }
    },
    save: async () => {
      saved += 1;
    },
  };
  Postulacion.findByPk = async () => postulacion;
});

test("guarda la observacion del familiar y marca el JSON como modificado", async () => {
  const response = await patchFamiliar({
    observacion: "Información familiar confirmada.",
  });

  assert.equal(response.status, 200);
  assert.equal(
    postulacion.formulario.familiares_postulante[0].observacion,
    "Información familiar confirmada.",
  );
  assert.equal(response.body.familiar.observacion, "Información familiar confirmada.");
  assert.equal(formularioMarkedAsChanged, true);
  assert.equal(saved, 1);
});

test("conserva la observacion al actualizar tambien el estado limpio", async () => {
  await patchFamiliar({ observacion: "Observación persistente." });
  const response = await patchFamiliar({
    limpio: true,
    observacion: "Observación persistente.",
  });

  assert.equal(response.status, 200);
  assert.equal(postulacion.formulario.familiares_postulante[0].limpio, true);
  assert.equal(
    postulacion.formulario.familiares_postulante[0].observacion,
    "Observación persistente.",
  );
  assert.equal(saved, 2);
});
