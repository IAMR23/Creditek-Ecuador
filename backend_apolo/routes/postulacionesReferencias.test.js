const assert = require("node:assert/strict");
const { beforeEach, test } = require("node:test");
const express = require("express");
const jwt = require("jsonwebtoken");

const Postulacion = require("../models/Postulacion");
const postulacionesRouter = require("./postulacionesRouter");

let postulacion;
let guardados;

const patchReferencia = async (tipo, index, body) => {
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
      `http://127.0.0.1:${address.port}/api/postulaciones/21/referencias/${tipo}/${index}/llamado`,
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

const patchObservacionGeneral = async (body) => {
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
      `http://127.0.0.1:${address.port}/api/postulaciones/21/referencias/observacion`,
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
  guardados = 0;
  postulacion = {
    id: 21,
    formulario: {
      personas_con_quien_vive: [
        {
          nombre: "Familiar de prueba",
          telefono: "0999999999",
          pariente: "Madre",
        },
      ],
      historial_laboral: [
        {
          empresaLugarTrabajo: "Empresa de prueba",
          jefeEncargado: "Jefe de prueba",
          telefonoReferencia: "022222222",
        },
      ],
      metadata: {},
    },
    save: async () => {
      guardados += 1;
    },
  };
  Postulacion.findByPk = async () => postulacion;
});

test("guarda el check llamado en una referencia familiar", async () => {
  const response = await patchReferencia("familiar", 0, { llamado: true });

  assert.equal(response.status, 200);
  assert.equal(
    postulacion.formulario.personas_con_quien_vive[0].llamado,
    true,
  );
  assert.equal(response.body.referencia.llamado, true);
  assert.equal(guardados, 1);
});

test("guarda el check llamado en una referencia laboral", async () => {
  const response = await patchReferencia("laboral", 0, { llamado: true });

  assert.equal(response.status, 200);
  assert.equal(postulacion.formulario.historial_laboral[0].llamado, true);
  assert.equal(response.body.referencia.llamado, true);
  assert.equal(guardados, 1);
});

test("guarda una observacion en la referencia", async () => {
  const response = await patchReferencia("familiar", 0, {
    observacion: "Confirmó la información proporcionada.",
  });

  assert.equal(response.status, 200);
  assert.equal(
    postulacion.formulario.personas_con_quien_vive[0].observacion,
    "Confirmó la información proporcionada.",
  );
  assert.equal(response.body.referencia.llamado, undefined);
  assert.equal(guardados, 1);
});

test("guarda una observacion general aunque no existan referencias", async () => {
  postulacion.formulario = { metadata: {} };

  const response = await patchObservacionGeneral({
    observacion: "No registró referencias, se validará en entrevista.",
  });

  assert.equal(response.status, 200);
  assert.equal(
    postulacion.formulario.metadata.observacion_referencias,
    "No registró referencias, se validará en entrevista.",
  );
  assert.equal(
    response.body.observacion,
    "No registró referencias, se validará en entrevista.",
  );
  assert.equal(guardados, 1);
});

test("exige una observacion general valida", async () => {
  const response = await patchObservacionGeneral({ observacion: null });

  assert.equal(response.status, 400);
  assert.match(response.body.message, /Debe enviar una observacion/);
  assert.equal(guardados, 0);
});

test("exige un estado llamado u observacion validos", async () => {
  const response = await patchReferencia("laboral", 0, { llamado: "si" });

  assert.equal(response.status, 400);
  assert.match(response.body.message, /estado llamado o una observacion/);
  assert.equal(guardados, 0);
});
