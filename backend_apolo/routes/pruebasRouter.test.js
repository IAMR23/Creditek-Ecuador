const assert = require("node:assert/strict");
const { test } = require("node:test");
const express = require("express");
const jwt = require("jsonwebtoken");

require("../models/associations");
const { sequelize } = require("../config/db");
const PruebaIntento = require("../models/PruebaIntento");
const PruebaRespuesta = require("../models/PruebaRespuesta");
const pruebasRouter = require("./pruebasRouter");
const { buildAttemptQuestions } = require("../services/pruebasService");

const tokenFor = (role, id = 7) =>
  jwt.sign(
    { usuario: { id, nombre: "Usuario de prueba", rol: { nombre: role } } },
    process.env.JWT_SECRET || "apolo_secret",
  );

const request = async (path, { method = "GET", body, role = "USUARIO" } = {}) => {
  const app = express();
  app.use(express.json());
  app.use("/api/pruebas", pruebasRouter);
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
  });
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/pruebas${path}`, {
      method,
      headers: {
        authorization: `Bearer ${tokenFor(role)}`,
        ...(body ? { "content-type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: response.status, body: await response.json() };
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
};

const makeAttempt = () => {
  const questions = buildAttemptQuestions("piso", () => 0.5);
  return {
    id: 91,
    usuarioId: 7,
    tipo: "piso",
    estado: "EN_PROGRESO",
    fechaInicio: new Date().toISOString(),
    preguntasSnapshot: questions,
    respuestas: questions.map((question, index) => ({
      id: index + 1,
      preguntaId: question.id,
      tipo: question.tipo,
      opcionSeleccionada: null,
      textoRespuesta: null,
      respuestaCorrecta: question.answer,
      correcta: null,
      puntajeAutomatico: null,
    })),
  };
};

test("protege la configuración por rol normalizado", async () => {
  assert.equal((await request("/configuracion", { role: "usuario" })).status, 200);
  assert.equal((await request("/configuracion", { role: "admin" })).status, 403);
  assert.equal((await request("/configuracion", { role: "SUPERVISOR" })).status, 403);
});

test("permite al ADMIN listar evaluaciones y bloquea la vista administrativa al USUARIO", async () => {
  PruebaIntento.findAll = async () => [];

  const adminResponse = await request("/admin/intentos", { role: "admin" });
  const userResponse = await request("/admin/intentos", { role: "USUARIO" });

  assert.equal(adminResponse.status, 200);
  assert.deepEqual(adminResponse.body.data, []);
  assert.equal(userResponse.status, 403);
});

test("un intento solo pertenece a su usuario", () => {
  assert.equal(pruebasRouter.ensureAttemptOwner({ usuarioId: 7 }, { id: 7 }), true);
  assert.throws(
    () => pruebasRouter.ensureAttemptOwner({ usuarioId: 8 }, { id: 7 }),
    (error) => error.statusCode === 404,
  );
});

test("impide modificar intentos finalizados", () => {
  assert.equal(pruebasRouter.ensureAttemptEditable({ estado: "EN_PROGRESO" }), true);
  assert.throws(
    () => pruebasRouter.ensureAttemptEditable({ estado: "PENDIENTE_REVISION" }),
    (error) => error.statusCode === 409,
  );
  assert.throws(
    () => pruebasRouter.ensureAttemptEditable({ estado: "CALIFICADA" }),
    (error) => error.statusCode === 409,
  );
});

test("bloquea intento y respuestas por separado para evitar FOR UPDATE sobre un outer join", async () => {
  const transaction = { LOCK: { UPDATE: "UPDATE" } };
  const attempt = makeAttempt();
  let attemptOptions;
  let responseOptions;
  PruebaIntento.findByPk = async (_id, options) => {
    attemptOptions = options;
    return attempt;
  };
  PruebaRespuesta.findAll = async (options) => {
    responseOptions = options;
    return attempt.respuestas;
  };

  const result = await pruebasRouter.findAttemptForUpdate(91, transaction);

  assert.equal(result.id, 91);
  assert.equal(attemptOptions.lock, "UPDATE");
  assert.equal(attemptOptions.include, undefined);
  assert.deepEqual(responseOptions.where, { intentoId: 91 });
  assert.equal(responseOptions.lock, "UPDATE");
});

test("permite al ADMIN calificar las siete respuestas abiertas y cerrar la evaluación", async () => {
  const attempt = makeAttempt();
  attempt.estado = "PENDIENTE_REVISION";
  attempt.notaAutomatica = 70;
  attempt.fechaEnvio = new Date().toISOString();
  attempt.participante = {
    id: 7,
    nombre: "Participante",
    email: "participante@example.com",
    agencias: [],
  };
  attempt.save = async () => attempt;
  attempt.respuestas = attempt.respuestas.map((answer) => ({
    ...answer,
    pregunta: answer.preguntaId,
    opciones: [],
    textoRespuesta: answer.tipo === "abierta" ? "Respuesta desarrollada" : null,
    opcionSeleccionada: answer.tipo === "opcion_multiple" ? "A" : null,
    correcta: answer.tipo === "opcion_multiple",
    save: async () => answer,
  }));
  sequelize.transaction = async (callback) =>
    callback({ LOCK: { UPDATE: "UPDATE" } });
  PruebaIntento.findByPk = async () => attempt;
  PruebaRespuesta.findAll = async () => attempt.respuestas;

  const calificaciones = attempt.respuestas
    .filter((answer) => answer.tipo === "abierta")
    .map((answer) => ({ preguntaId: answer.preguntaId, puntaje: 5 }));
  const response = await request("/admin/intentos/91/calificar", {
    method: "PUT",
    role: "ADMIN",
    body: { calificaciones, observacionGeneral: "Buen resultado" },
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.data.estado, "CALIFICADA");
  assert.equal(response.body.data.notaSupervisor, 30);
  assert.equal(response.body.data.notaFinal, 100);
  assert.equal(response.body.data.aprobado, true);
});

test("reanuda el único intento en progreso sin crear otro ni revelar datos internos", async () => {
  let createCalls = 0;
  PruebaIntento.findOne = async () => makeAttempt();
  PruebaIntento.create = async () => {
    createCalls += 1;
  };

  const response = await request("/intentos", {
    method: "POST",
    body: { tipo: "call_center" },
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.reanudado, true);
  assert.equal(response.body.data.id, 91);
  assert.equal(createCalls, 0);
  assert.ok(response.body.data.preguntas.every((question) => question.respuestaCorrecta === undefined));
  assert.ok(response.body.data.respuestas.every((answer) => answer.respuestaCorrecta === undefined));
  assert.ok(response.body.data.preguntas.every((question) => question.rubric === undefined));
  assert.ok(response.body.data.preguntas.every((question) => question.scope === undefined));
});

test("oculta respuestas correctas y puntajes internos incluso al participante calificado", () => {
  const attempt = makeAttempt();
  attempt.estado = "CALIFICADA";
  attempt.notaAutomatica = 70;
  attempt.notaSupervisor = 30;
  attempt.notaFinal = 100;
  attempt.aprobado = true;
  attempt.respuestas = attempt.respuestas.map((answer) => ({
    ...answer,
    correcta: true,
    puntajeAutomatico: 70 / 23,
    puntajeSupervisor: answer.tipo === "abierta" ? 5 : null,
    observacionSupervisor: "Dato interno",
  }));

  const dto = pruebasRouter.participantAttemptDto(attempt);
  assert.equal(dto.notaFinal, 100);
  assert.equal(dto.aprobado, true);
  for (const answer of dto.respuestas) {
    assert.equal(answer.respuestaCorrecta, undefined);
    assert.equal(answer.correcta, undefined);
    assert.equal(answer.puntajeAutomatico, undefined);
    assert.equal(answer.puntajeSupervisor, undefined);
    assert.equal(answer.observacionSupervisor, undefined);
  }
});
