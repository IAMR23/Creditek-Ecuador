const assert = require("node:assert/strict");
const { test } = require("node:test");
const express = require("express");

const Agencia = require("../models/Agencia");
const Asistencia = require("../models/Asistencia");
const Postulacion = require("../models/Postulacion");
const UsuarioAgencia = require("../models/UsuarioAgencia");
const asistenciaRoutes = require("./AsistenciaRoutes");

const getJson = async (path) => {
  const app = express();
  app.use(express.json());
  app.use("/asistencias", asistenciaRoutes);

  const server = await new Promise((resolve) => {
    const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
  });

  try {
    const address = server.address();
    const response = await fetch(
      `http://127.0.0.1:${address.port}/asistencias${path}`,
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

test("muestra Usuario.fechaSalida aunque aún no exista una asistencia", async () => {
  let agenciaOptions;
  Agencia.findAll = async (options) => {
    agenciaOptions = options;
    return [{ id: 2, nombre: "Matriz", tipo: "AGENCIA" }];
  };
  let consultasRelaciones = 0;
  UsuarioAgencia.findAll = async () => {
    consultasRelaciones += 1;

    if (consultasRelaciones === 1) {
      return [
        {
          id: 10,
          usuarioId: 5,
          agenciaId: 2,
          activo: true,
          usuario: {
            id: 5,
            nombre: "María Pérez",
            fechaIngreso: "2026-07-20",
            fechaSalida: "2026-07-27",
          },
          agencia: { id: 2, nombre: "Matriz" },
        },
      ];
    }

    return [
      {
        id: 10,
        usuarioId: 5,
        agenciaId: 2,
        activo: true,
      },
    ];
  };
  Asistencia.findAll = async () => [];

  const response = await getJson("/agencias?mes=2026-07&agenciaId=2");

  assert.equal(response.status, 200);
  assert.deepEqual(agenciaOptions.order, [
    ["tipo", "ASC"],
    ["nombre", "ASC"],
  ]);
  assert.equal(response.body[0].tipo, "AGENCIA");
  assert.equal(
    response.body[0].usuarios[0].fechaIngreso,
    "2026-07-20",
  );
  assert.equal(
    response.body[0].usuarios[0].asistencias["2026-07-27"].estado,
    "salida",
  );
});

test("filtra los movimientos para mostrar solo personal activo en capacitacion", async () => {
  Agencia.findAll = async () => [{ id: 2, nombre: "Matriz" }];
  let postulacionOptions;
  Postulacion.findAll = async (options) => {
    postulacionOptions = options;
    return [
      {
        cedula: "010-203-0405",
        formulario: {},
      },
    ];
  };

  let consultasRelaciones = 0;
  UsuarioAgencia.findAll = async () => {
    consultasRelaciones += 1;

    if (consultasRelaciones === 1) {
      return [
        {
          id: 10,
          usuarioId: 5,
          agenciaId: 2,
          activo: true,
          usuario: {
            id: 5,
            cedula: "0102030405",
            nombre: "Persona en capacitacion",
            fechaIngreso: "2026-07-20",
            fechaSalida: null,
          },
          agencia: { id: 2, nombre: "Matriz" },
        },
        {
          id: 11,
          usuarioId: 6,
          agenciaId: 2,
          activo: true,
          usuario: {
            id: 6,
            cedula: "9999999999",
            nombre: "Persona fuera de capacitacion",
            fechaIngreso: "2026-07-20",
            fechaSalida: null,
          },
          agencia: { id: 2, nombre: "Matriz" },
        },
      ];
    }

    return [{ id: 10, usuarioId: 5, agenciaId: 2, activo: true }];
  };
  Asistencia.findAll = async () => [];

  const response = await getJson(
    "/agencias?mes=2026-07&fase=capacitacion",
  );

  assert.equal(response.status, 200);
  assert.equal(postulacionOptions.where.estadoEntrevista, "CAPACITACION");
  assert.equal(response.body.length, 1);
  assert.equal(response.body[0].usuarios.length, 1);
  assert.equal(response.body[0].usuarios[0].usuarioId, 5);
  assert.equal(response.body[0].usuarios[0].nombre, "Persona en capacitacion");
});
