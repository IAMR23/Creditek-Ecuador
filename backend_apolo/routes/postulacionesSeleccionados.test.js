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
    cedula: "0102030405",
    pasaEntrevista: true,
    descartada: false,
    fechaEntrevista: new Date("2026-07-27T15:00:00.000Z"),
    estadoEntrevista: "REALIZADA",
    formulario: {},
    changed: () => {},
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

test("permite marcar una entrevista como no contesto", async () => {
  candidate.fechaEntrevista = null;
  const response = await request("/21/estado-entrevista", {
    method: "PATCH",
    body: { estadoEntrevista: "NO_CONTESTO" },
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.data.estadoEntrevista, "NO_CONTESTO");
  assert.equal(candidate.estadoEntrevista, "NO_CONTESTO");
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

test("obtiene la evaluacion de desempeno de un postulante seleccionado", async () => {
  candidate.estadoEntrevista = "SELECCIONADO";
  candidate.formulario.evaluacion_desempeno = {
    version: "evaluacion-desempeno-v1",
    puntajeTotal: 80,
  };

  const response = await request("/21/evaluacion-desempeno");

  assert.equal(response.status, 200);
  assert.equal(response.body.data.postulacion.nombre, "Postulante de prueba");
  assert.equal(response.body.data.evaluacion.puntajeTotal, 80);
});

test("guarda y calcula la evaluacion de desempeno sobre 100 puntos", async () => {
  candidate.estadoEntrevista = "SELECCIONADO";
  const criteria = [
    "iniciativa_actitud",
    "ganas_aprender",
    "proactividad",
    "cumplimiento_metas",
    "disposicion_venta",
    "volanteo_comunicacion",
    "proceso_venta",
    "uso_herramientas",
    "argumentacion_beneficios",
    "manejo_objeciones",
    "registro_informacion",
    "horarios_normas",
    "constancia",
    "organizacion_tiempo",
    "cumplimiento_tareas",
    "orden_actitud",
  ];

  const response = await request("/21/evaluacion-desempeno", {
    method: "PUT",
    body: {
      periodoDesde: "2026-08-03",
      periodoHasta: "2026-08-08",
      evaluador: "Evaluador de prueba",
      fechaEvaluacion: "2026-08-08",
      calificaciones: Object.fromEntries(criteria.map((id) => [id, 5])),
      observaciones: {
        quiere_hacer: "Actitud positiva.",
        sabe_hacer: "Aplica el proceso.",
        disciplinada: "Cumple horarios.",
      },
      ventas: [1, 1, 1, 1, 0, 0],
      comentariosGenerales: "Apto para continuar.",
      recomendacion: "APROBADO",
      firmaEvaluador: "Evaluador de prueba",
    },
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.data.puntajeAspectos, 75);
  assert.equal(response.body.data.puntajeVentas, 20);
  assert.equal(response.body.data.puntajeTotal, 95);
  assert.equal(response.body.data.metaCumplida, true);
  assert.equal(response.body.data.cumpleAprobacion, true);
  assert.equal(candidate.formulario.evaluacion_desempeno.puntajeTotal, 95);
  assert.equal(saved, 1);
});

test("rechaza la evaluacion de un postulante que no esta seleccionado", async () => {
  const response = await request("/21/evaluacion-desempeno", {
    method: "PUT",
    body: {
      ventas: [0, 0, 0, 0, 0, 0],
    },
  });

  assert.equal(response.status, 409);
  assert.match(response.body.message, /seleccionados/i);
  assert.equal(saved, 0);
});
