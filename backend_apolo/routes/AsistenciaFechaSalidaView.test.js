const assert = require("node:assert/strict");
const { test } = require("node:test");
const express = require("express");

const Agencia = require("../models/Agencia");
const Asistencia = require("../models/Asistencia");
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
  Agencia.findAll = async () => [{ id: 2, nombre: "Matriz" }];
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
  assert.equal(
    response.body[0].usuarios[0].fechaIngreso,
    "2026-07-20",
  );
  assert.equal(
    response.body[0].usuarios[0].asistencias["2026-07-27"].estado,
    "salida",
  );
});
