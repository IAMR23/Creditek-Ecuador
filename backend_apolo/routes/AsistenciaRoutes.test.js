const assert = require("node:assert/strict");
const { beforeEach, test } = require("node:test");
const express = require("express");

const rveSyncService = require("../services/rveSyncService");
let sincronizacionImpl = async () => ({ ok: true, sincronizado: true });
rveSyncService.sincronizarSalidaUsuarioRve = (payload) =>
  sincronizacionImpl(payload);

const { sequelize } = require("../config/db");
const Asistencia = require("../models/Asistencia");
const Usuario = require("../models/Usuario");
const UsuarioAgencia = require("../models/UsuarioAgencia");
const asistenciaRoutes = require("./AsistenciaRoutes");

const usuario = {
  id: 5,
  cedula: "0102030405",
  fechaSalida: null,
  save: async () => {},
};

const postJson = async (ruta, body) => {
  const app = express();
  app.use(express.json());
  app.use("/asistencias", asistenciaRoutes);

  const server = await new Promise((resolve) => {
    const instancia = app.listen(0, "127.0.0.1", () => resolve(instancia));
  });

  try {
    const address = server.address();
    const response = await fetch(
      `http://127.0.0.1:${address.port}/asistencias${ruta}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
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
  usuario.fechaSalida = null;
  usuario.save = async () => {};
  sincronizacionImpl = async () => ({ ok: true, sincronizado: true });

  sequelize.transaction = async (callback) => callback({ id: "transaction" });
  Usuario.findByPk = async () => usuario;
  UsuarioAgencia.findByPk = async () => ({
    id: 10,
    usuarioId: 5,
    agenciaId: 2,
    activo: true,
  });
  UsuarioAgencia.findAll = async () => [{ id: 10, usuarioId: 5 }];
  Asistencia.findOne = async () => null;
  Asistencia.findAll = async () => [];
  Asistencia.destroy = async () => 0;
  Asistencia.upsert = async (values) => [{ id: 30, ...values }, true];
});

test("la salida individual actualiza ABS y sincroniza por cedula", async () => {
  const sincronizaciones = [];
  let guardados = 0;
  usuario.save = async () => {
    guardados += 1;
  };
  sincronizacionImpl = async (payload) => {
    sincronizaciones.push(payload);
    return { ok: true, sincronizado: true };
  };

  const response = await postJson("", {
    agenciaId: 2,
    usuarioAgenciaId: 10,
    fecha: "2026-07-24",
    estado: "salida",
    observacion: "",
  });

  assert.equal(response.status, 201);
  assert.equal(usuario.fechaSalida, "2026-07-24");
  assert.equal(guardados, 1);
  assert.deepEqual(sincronizaciones, [
    {
      usuarioId: 5,
      cedula: "0102030405",
      fechaSalida: "2026-07-24",
      desactivar: false,
    },
  ]);
});

test("la salida masiva usa fechaInicio como fechaSalida", async () => {
  const sincronizaciones = [];
  const asistenciasGuardadas = [];
  sincronizacionImpl = async (payload) => {
    sincronizaciones.push(payload);
    return { ok: true, sincronizado: true };
  };
  Asistencia.upsert = async (values) => {
    asistenciasGuardadas.push(values);
    return [values, true];
  };

  const response = await postJson("/masivo", {
    agenciaId: 2,
    usuarioAgenciaIds: [10],
    fechaInicio: "2026-07-24",
    fechaFin: "2026-07-25",
    estado: "salida",
    observacion: "",
  });

  assert.equal(response.status, 200);
  assert.equal(asistenciasGuardadas.length, 2);
  assert.equal(usuario.fechaSalida, "2026-07-24");
  assert.equal(sincronizaciones[0].fechaSalida, "2026-07-24");
});

test("al remover la unica salida limpia y sincroniza fechaSalida", async () => {
  const sincronizaciones = [];
  let consulta = 0;
  usuario.fechaSalida = "2026-07-24";
  sincronizacionImpl = async (payload) => {
    sincronizaciones.push(payload);
    return { ok: true, sincronizado: true };
  };
  Asistencia.findOne = async () => {
    consulta += 1;
    return consulta === 1
      ? { id: 30, usuarioAgenciaId: 10, fecha: "2026-07-24", estado: "salida" }
      : null;
  };
  Asistencia.destroy = async () => 1;

  const response = await postJson("", {
    agenciaId: 2,
    usuarioAgenciaId: 10,
    fecha: "2026-07-24",
    estado: "libre",
    observacion: "",
  });

  assert.equal(response.status, 200);
  assert.equal(usuario.fechaSalida, null);
  assert.equal(sincronizaciones[0].fechaSalida, null);
});

test("al remover una salida recalcula desde otra salida restante", async () => {
  const sincronizaciones = [];
  let consulta = 0;
  usuario.fechaSalida = "2026-07-24";
  sincronizacionImpl = async (payload) => {
    sincronizaciones.push(payload);
    return { ok: true, sincronizado: true };
  };
  Asistencia.findOne = async () => {
    consulta += 1;
    if (consulta === 1) {
      return {
        id: 30,
        usuarioAgenciaId: 10,
        fecha: "2026-07-24",
        estado: "salida",
      };
    }

    return {
      id: 31,
      usuarioAgenciaId: 10,
      fecha: "2026-07-20",
      estado: "salida",
    };
  };

  const response = await postJson("", {
    agenciaId: 2,
    usuarioAgenciaId: 10,
    fecha: "2026-07-24",
    estado: "asistencia",
    observacion: "",
  });

  assert.equal(response.status, 201);
  assert.equal(usuario.fechaSalida, "2026-07-20");
  assert.equal(sincronizaciones[0].fechaSalida, "2026-07-20");
});

test("un fallo de RVE no revierte la asistencia ni la fecha en ABS", async (t) => {
  t.mock.method(console, "error", () => {});
  sincronizacionImpl = async () => {
    throw new Error("RVE no disponible");
  };

  const response = await postJson("", {
    agenciaId: 2,
    usuarioAgenciaId: 10,
    fecha: "2026-07-24",
    estado: "salida",
    observacion: "",
  });

  assert.equal(response.status, 201);
  assert.equal(usuario.fechaSalida, "2026-07-24");
});
